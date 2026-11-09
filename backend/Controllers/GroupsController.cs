using System.Security.Claims;
using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GroupsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly UserManager<User> _userManager;

    public GroupsController(
        ApplicationDbContext db,
        UserManager<User> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    private int? GetCurrentUserId()
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        return int.TryParse(userId, out var id)
            ? id
            : null;
    }

    [HttpGet]
    public async Task<IActionResult> GetGroups()
    {
        var query = _db.TrainingGroups.AsNoTracking();

        // Тренер видит только собственные группы.
        if (User.IsInRole("Coach"))
        {
            var coachId = GetCurrentUserId();

            if (coachId is null)
                return Unauthorized();

            query = query.Where(g => g.CoachId == coachId.Value);
        }

        var groups = await query
            .OrderBy(g => g.Name)
            .Select(g => new
            {
                g.TrainingGroupId,
                g.Name,
                g.Description,
                g.CoachId,
                AthletesCount = g.Memberships.Count(
                    m => m.LeftDate == null)
            })
            .ToListAsync();

        return Ok(groups);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetGroup(int id)
    {
        var query = _db.TrainingGroups
            .AsNoTracking()
            .Where(g => g.TrainingGroupId == id);

        // Тренер может просматривать только свою группу.
        if (User.IsInRole("Coach"))
        {
            var coachId = GetCurrentUserId();

            if (coachId is null)
                return Unauthorized();

            query = query.Where(g => g.CoachId == coachId.Value);
        }

        var group = await query
            .Select(g => new
            {
                g.TrainingGroupId,
                g.Name,
                g.Description,
                g.CoachId,
                AthletesCount = g.Memberships.Count(
                    m => m.LeftDate == null)
            })
            .FirstOrDefaultAsync();

        if (group is null)
        {
            return NotFound(new
            {
                message = "Group not found."
            });
        }

        return Ok(group);
    }

    [HttpGet("coach-check")]
    [Authorize(Roles = "Coach")]
    public IActionResult CoachCheck()
    {
        return Ok(new
        {
            message = "Coach access confirmed."
        });
    }

    [HttpPost]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> CreateGroup(
        CreateGroupDto dto)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var name = dto.Name.Trim();

        if (name.Length < 2)
        {
            return BadRequest(new
            {
                message =
                    "Group name must contain at least 2 characters."
            });
        }

        var group = new TrainingGroup
        {
            Name = name,
            Description = dto.Description?.Trim(),
            CoachId = coachId.Value
        };

        _db.TrainingGroups.Add(group);
        await _db.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetGroup),
            new { id = group.TrainingGroupId },
            new
            {
                group.TrainingGroupId,
                group.Name,
                group.Description,
                group.CoachId,
                AthletesCount = 0
            });
    }

    [HttpGet("athletes/available")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> GetAvailableAthletes()
    {
        var athletes = await _userManager.GetUsersInRoleAsync("Athlete");

        var result = athletes
            .OrderBy(a => a.Surname)
            .ThenBy(a => a.Name)
            .Select(a => new
            {
                AthleteId = a.Id,
                a.Name,
                a.Surname,
                a.Email
            })
            .ToList();

        return Ok(result);
    }

    [HttpGet("{id:int}/athletes/available")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> GetAvailableAthletesForGroup(int id)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        // Проверяем, что группа принадлежит текущему тренеру.
        var groupExists = await _db.TrainingGroups
            .AnyAsync(g =>
                g.TrainingGroupId == id &&
                g.CoachId == coachId.Value);

        if (!groupExists)
        {
            return NotFound(new
            {
                message = "Group not found."
            });
        }

        // Получаем ID спортсменов, которые сейчас в группе.
        var activeAthleteIds = await _db.GroupMemberships
            .AsNoTracking()
            .Where(m =>
                m.TrainingGroupId == id &&
                m.LeftDate == null)
            .Select(m => m.AthleteId)
            .ToListAsync();

        // Получаем всех зарегистрированных спортсменов.
        var allAthletes = await _userManager
            .GetUsersInRoleAsync("Athlete");

        // Исключаем действующих участников выбранной группы.
        var availableAthletes = allAthletes
            .Where(a => !activeAthleteIds.Contains(a.Id))
            .OrderBy(a => a.Surname)
            .ThenBy(a => a.Name)
            .Select(a => new
            {
                AthleteId = a.Id,
                a.Name,
                a.Surname,
                a.Email
            })
            .ToList();

        return Ok(availableAthletes);
    }

    [HttpGet("{id:int}/athletes")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> GetGroupAthletes(int id)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var groupExists = await _db.TrainingGroups
            .AnyAsync(g =>
                g.TrainingGroupId == id &&
                g.CoachId == coachId.Value);

        if (!groupExists)
        {
            return NotFound(new
            {
                message = "Group not found."
            });
        }

        var athletes = await _db.GroupMemberships
            .AsNoTracking()
            .Where(m =>
                m.TrainingGroupId == id &&
                m.LeftDate == null)
            .OrderBy(m => m.Athlete.Surname)
            .ThenBy(m => m.Athlete.Name)
            .Select(m => new
            {
                m.AthleteId,
                m.Athlete.Name,
                m.Athlete.Surname,
                m.Athlete.Email,
                m.JoinedDate
            })
            .ToListAsync();

        return Ok(athletes);
    }

    [HttpDelete("{id:int}/athletes/{athleteId:int}")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> RemoveAthleteFromGroup(
        int id,
        int athleteId)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        // Проверяем, что группа принадлежит этому тренеру.
        var groupExists = await _db.TrainingGroups
            .AnyAsync(g =>
                g.TrainingGroupId == id &&
                g.CoachId == coachId.Value);

        if (!groupExists)
        {
            return NotFound(new
            {
                message = "Group not found."
            });
        }

        // Находим действующее членство спортсмена.
        var membership = await _db.GroupMemberships
            .FirstOrDefaultAsync(m =>
                m.TrainingGroupId == id &&
                m.AthleteId == athleteId &&
                m.LeftDate == null);

        if (membership is null)
        {
            return NotFound(new
            {
                message =
                    "Active athlete membership not found."
            });
        }

        // Сохраняем историю, не удаляя запись.
        membership.LeftDate = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return NoContent();
    }


    
    [HttpPost("{id:int}/athletes")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> AddAthleteToGroup(
        int id,
        AddAthleteToGroupDto dto)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        // Проверяем, что группа принадлежит текущему тренеру.
        var groupExists = await _db.TrainingGroups
            .AnyAsync(g =>
                g.TrainingGroupId == id &&
                g.CoachId == coachId.Value);

        if (!groupExists)
        {
            return NotFound(new
            {
                message = "Group not found."
            });
        }

        // Проверяем, что пользователь существует и является спортсменом.
        var athlete = await _userManager.FindByIdAsync(
            dto.AthleteId.ToString());

        if (athlete is null ||
            !await _userManager.IsInRoleAsync(athlete, "Athlete"))
        {
            return NotFound(new
            {
                message = "Athlete not found."
            });
        }

        // Не допускаем повторное активное членство в группе.
        var alreadyMember = await _db.GroupMemberships
            .AnyAsync(m =>
                m.TrainingGroupId == id &&
                m.AthleteId == dto.AthleteId &&
                m.LeftDate == null);

        if (alreadyMember)
        {
            return Conflict(new
            {
                message = "Athlete is already in this group."
            });
        }

        var now = DateTime.UtcNow;
        var today = now.Date;
        var currentTime = TimeOnly.FromDateTime(now);

        // Создаём членство в группе.
        var membership = new GroupMembership
        {
            TrainingGroupId = id,
            AthleteId = dto.AthleteId,
            JoinedDate = now
        };

        _db.GroupMemberships.Add(membership);

        // Находим тренировки этой группы, которые ещё не начались.
        var futureTrainings = await _db.Trainings
            .Where(t =>
                t.TrainingGroupId == id &&
                t.Status == TrainingStatus.Planned &&
                (t.Date.Date > today ||
                (t.Date.Date == today && t.StartTime > currentTime)))
            .Select(t => t.TrainingId)
            .ToListAsync();

        // Получаем тренировки, где спортсмен ещё не назначен участником.
        var existingTrainingIds = await _db.TrainingParticipants
            .Where(p =>
                p.AthleteId == dto.AthleteId &&
                futureTrainings.Contains(p.TrainingId))
            .Select(p => p.TrainingId)
            .ToListAsync();

        var existingIds = existingTrainingIds.ToHashSet();

        var newParticipants = futureTrainings
            .Where(trainingId => !existingIds.Contains(trainingId))
            .Select(trainingId => new TrainingParticipant
            {
                TrainingId = trainingId,
                AthleteId = dto.AthleteId,
                Status = AttendanceStatus.Unmarked
            })
            .ToList();

        if (newParticipants.Count > 0)
            _db.TrainingParticipants.AddRange(newParticipants);

        // Сохраняем членство и назначения участников вместе.
        await _db.SaveChangesAsync();

        return Created(
            $"/api/Groups/{id}",
            new
            {
                membership.GroupMembershipId,
                membership.TrainingGroupId,
                membership.AthleteId,
                membership.JoinedDate,
                AddedToFutureTrainings = newParticipants.Count
            });
    }

}
