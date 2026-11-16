
using System.Security.Claims;
using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PhysicalMeasurementsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public PhysicalMeasurementsController(ApplicationDbContext db)
    {
        _db = db;
    }

    private bool TryGetCurrentUserId(out int userId)
    {
        return int.TryParse(
            User.FindFirstValue(ClaimTypes.NameIdentifier),
            out userId);
    }

    private IQueryable<int> GetCoachAthleteProfileIds(int coachId)
    {
        return _db.GroupMemberships
            .Where(m =>
                m.LeftDate == null &&
                m.TrainingGroup.CoachId == coachId)
            .Select(m => m.AthleteProfileId)
            .Distinct();
    }

    private IQueryable<int> GetParentChildProfileIds(int parentId)
    {
        return _db.ParentAthletes
            .Where(pa => pa.ParentId == parentId)
            .Select(pa => pa.AthleteProfileId);
    }

    private IQueryable<int> GetCurrentAthleteProfileIds(int userId)
    {
        return _db.AthleteProfiles
            .Where(a => a.UserId == userId)
            .Select(a => a.AthleteProfileId);
    }

    private IQueryable<PhysicalMeasurement> ApplyAccessFilter(
        IQueryable<PhysicalMeasurement> query,
        int userId)
    {
        if (User.IsInRole("Coach"))
        {
            var profileIds = GetCoachAthleteProfileIds(userId);

            return query.Where(m =>
                profileIds.Contains(m.AthleteProfileId));
        }

        if (User.IsInRole("Athlete"))
        {
            var profileIds = GetCurrentAthleteProfileIds(userId);

            return query.Where(m =>
                profileIds.Contains(m.AthleteProfileId));
        }

        if (User.IsInRole("Parent"))
        {
            var profileIds = GetParentChildProfileIds(userId);

            return query.Where(m =>
                profileIds.Contains(m.AthleteProfileId));
        }

        return query.Where(m => false);
    }

    // Получение измерений текущего спортсмена по его аккаунту.
    [HttpGet("my")]
    [Authorize(Roles = "Athlete")]
    public async Task<IActionResult> GetMyMeasurements(
        [FromQuery] MeasurementType? type)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var athleteProfileId = await _db.AthleteProfiles
            .Where(a => a.UserId == userId)
            .Select(a => (int?)a.AthleteProfileId)
            .FirstOrDefaultAsync();

        if (!athleteProfileId.HasValue)
        {
            return NotFound(new
            {
                message = "Athlete profile not found."
            });
        }

        return await GetAthleteMeasurements(
            athleteProfileId.Value,
            type);
    }

    // Получение всех измерений конкретного спортсмена.
    [HttpGet("athlete/{athleteId:int}")]
    public async Task<IActionResult> GetAthleteMeasurements(
        int athleteId,
        [FromQuery] MeasurementType? type)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var athleteExists = await _db.AthleteProfiles
            .AnyAsync(a => a.AthleteProfileId == athleteId);

        if (!athleteExists)
        {
            return NotFound(new
            {
                message = "Athlete not found."
            });
        }

        if (type.HasValue &&
            !Enum.IsDefined(typeof(MeasurementType), type.Value))
        {
            return BadRequest(new
            {
                message = "Invalid measurement type."
            });
        }

        var query = ApplyAccessFilter(
            _db.PhysicalMeasurements
                .AsNoTracking()
                .Include(m => m.GroupMetric),
            userId);

        query = query.Where(m =>
            m.AthleteProfileId == athleteId);

        if (type.HasValue)
            query = query.Where(m => m.Type == type.Value);

        var measurements = await query
            .OrderByDescending(m => m.MeasuredAt)
            .Select(m => new
            {
                m.PhysicalMeasurementId,

                AthleteId = m.AthleteProfileId,
                m.AthleteProfileId,

                m.Type,

                m.GroupMetricId,
                GroupMetricName = m.GroupMetric != null
                    ? m.GroupMetric.Name
                    : null,
                GroupMetricUnit = m.GroupMetric != null
                    ? m.GroupMetric.Unit
                    : null,
                TrainingGroupId = m.GroupMetric != null
                    ? m.GroupMetric.TrainingGroupId
                    : (int?)null,

                m.Value,
                m.MeasuredAt,
                m.Note,
                m.RecordedByUserId,
                RecordedByName =
                    m.RecordedByUser.Name + " " +
                    m.RecordedByUser.Surname
            })
            .ToListAsync();

        if (measurements.Count == 0 &&
            !await CanAccessAthleteAsync(userId, athleteId))
        {
            return NotFound(new
            {
                message = "Athlete not found."
            });
        }

        return Ok(measurements);
    }

    // Старый endpoint — сохраняем для совместимости.
    [HttpPost("athlete/{athleteId:int}")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> CreateMeasurement(
        int athleteId,
        [FromBody] CreatePhysicalMeasurementDto dto)
    {
        if (!TryGetCurrentUserId(out var coachId))
            return Unauthorized();

        if (!Enum.IsDefined(typeof(MeasurementType), dto.Type))
        {
            return BadRequest(new
            {
                message = "Invalid measurement type."
            });
        }

        if (dto.Value <= 0)
        {
            return BadRequest(new
            {
                message = "Measurement value must be greater than zero."
            });
        }

        var athleteExists = await _db.AthleteProfiles
            .AnyAsync(a => a.AthleteProfileId == athleteId);

        if (!athleteExists)
        {
            return NotFound(new
            {
                message = "Athlete not found."
            });
        }

        var coachCanAccessAthlete =
            await GetCoachAthleteProfileIds(coachId)
                .AnyAsync(id => id == athleteId);

        if (!coachCanAccessAthlete)
        {
            return NotFound(new
            {
                message = "Athlete not found in your groups."
            });
        }

        var measuredAt = dto.MeasuredAt.HasValue
            ? DateTime.SpecifyKind(
                dto.MeasuredAt.Value,
                DateTimeKind.Utc)
            : DateTime.UtcNow;

        var measurement = new PhysicalMeasurement
        {
            AthleteProfileId = athleteId,
            RecordedByUserId = coachId,
            Type = dto.Type,
            GroupMetricId = null,
            Value = dto.Value,
            MeasuredAt = measuredAt,
            Note = dto.Note?.Trim()
        };

        _db.PhysicalMeasurements.Add(measurement);
        await _db.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetAthleteMeasurements),
            new { athleteId },
            new
            {
                measurement.PhysicalMeasurementId,
                AthleteId = measurement.AthleteProfileId,
                measurement.AthleteProfileId,
                measurement.Type,
                measurement.Value,
                measurement.MeasuredAt,
                measurement.Note
            });
    }

    // Новое измерение по пользовательской метрике группы.
    [HttpPost("athlete/{athleteId:int}/metric/{metricId:int}")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> CreateGroupMetricMeasurement(
        int athleteId,
        int metricId,
        [FromBody] CreateGroupMetricMeasurementDto dto)
    {
        if (!TryGetCurrentUserId(out var coachId))
            return Unauthorized();

        if (dto.Value <= 0)
        {
            return BadRequest(new
            {
                message = "Measurement value must be greater than zero."
            });
        }

        var metric = await _db.GroupMetrics
            .FirstOrDefaultAsync(m =>
                m.GroupMetricId == metricId &&
                m.IsActive &&
                m.TrainingGroup.CoachId == coachId);

        if (metric is null)
        {
            return NotFound(new
            {
                message = "Active metric not found in your groups."
            });
        }

        var athleteIsInGroup = await _db.GroupMemberships
            .AnyAsync(m =>
                m.AthleteProfileId == athleteId &&
                m.TrainingGroupId == metric.TrainingGroupId &&
                m.LeftDate == null);

        if (!athleteIsInGroup)
        {
            return BadRequest(new
            {
                message = "Athlete is not an active member of this metric's group."
            });
        }

        var measuredAt = dto.MeasuredAt.HasValue
            ? DateTime.SpecifyKind(
                dto.MeasuredAt.Value,
                DateTimeKind.Utc)
            : DateTime.UtcNow;

        var measurement = new PhysicalMeasurement
        {
            AthleteProfileId = athleteId,
            RecordedByUserId = coachId,
            Type = null,
            GroupMetricId = metric.GroupMetricId,
            Value = dto.Value,
            MeasuredAt = measuredAt,
            Note = dto.Note?.Trim()
        };

        _db.PhysicalMeasurements.Add(measurement);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            measurement.PhysicalMeasurementId,
            AthleteId = measurement.AthleteProfileId,
            measurement.AthleteProfileId,
            measurement.GroupMetricId,
            GroupMetricName = metric.Name,
            GroupMetricUnit = metric.Unit,
            TrainingGroupId = metric.TrainingGroupId,
            measurement.Value,
            measurement.MeasuredAt,
            measurement.Note,
            measurement.RecordedByUserId
        });
    }

    private async Task<bool> CanAccessAthleteAsync(
        int userId,
        int athleteProfileId)
    {
        if (User.IsInRole("Athlete"))
        {
            return await _db.AthleteProfiles.AnyAsync(a =>
                a.AthleteProfileId == athleteProfileId &&
                a.UserId == userId);
        }

        if (User.IsInRole("Parent"))
        {
            return await _db.ParentAthletes.AnyAsync(pa =>
                pa.ParentId == userId &&
                pa.AthleteProfileId == athleteProfileId);
        }

        if (User.IsInRole("Coach"))
        {
            return await GetCoachAthleteProfileIds(userId)
                .AnyAsync(id => id == athleteProfileId);
        }

        return false;
    }
}
