
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
public class GroupsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public GroupsController(ApplicationDbContext db)
    {
        _db = db;
    }

    private int? GetCurrentUserId()
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        return int.TryParse(userId, out var id)
            ? id
            : null;
    }

    private async Task<bool> CoachOwnsActiveGroup(
        int groupId,
        int coachId)
    {
        return await _db.TrainingGroups.AnyAsync(g =>
            g.TrainingGroupId == groupId &&
            g.CoachId == coachId &&
            !g.IsArchived);
    }

    // Профиль доступен тренеру, если:
    // 1. Он создан этим тренером.
    // 2. Он связан с аккаунтом спортсмена (совместимость со старой системой).
    // 3. У него есть история членства в группах этого тренера.
    private IQueryable<AthleteProfile> GetVisibleAthleteProfiles(
        int coachId)
    {
        return _db.AthleteProfiles.Where(a =>
            a.CreatedByUserId == coachId ||
            a.UserId != null ||
            a.GroupMemberships.Any(m =>
                m.TrainingGroup.CoachId == coachId));
    }

    // ==============================
    // GROUPS
    // ==============================

    [HttpGet]
    public async Task<IActionResult> GetGroups()
    {
        var query = _db.TrainingGroups
            .AsNoTracking()
            .Where(g => !g.IsArchived);

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
                    m => m.LeftDate == null &&
                         !m.AthleteProfile.IsArchived)
            })
            .ToListAsync();

        return Ok(groups);
    }

    [HttpGet("archived")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> GetArchivedGroups()
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var groups = await _db.TrainingGroups
            .AsNoTracking()
            .Where(g =>
                g.CoachId == coachId.Value &&
                g.IsArchived)
            .OrderBy(g => g.Name)
            .Select(g => new
            {
                g.TrainingGroupId,
                g.Name,
                g.Description,
                g.CoachId,
                AthletesCount = g.Memberships.Count(
                    m => m.LeftDate == null &&
                         !m.AthleteProfile.IsArchived)
            })
            .ToListAsync();

        return Ok(groups);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetGroup(int id)
    {
        var query = _db.TrainingGroups
            .AsNoTracking()
            .Where(g =>
                g.TrainingGroupId == id &&
                !g.IsArchived);

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
                    m => m.LeftDate == null &&
                         !m.AthleteProfile.IsArchived)
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
            CoachId = coachId.Value,
            IsArchived = false
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

    [HttpDelete("{id:int}/archive")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> ArchiveGroup(int id)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var group = await _db.TrainingGroups
            .FirstOrDefaultAsync(g =>
                g.TrainingGroupId == id &&
                g.CoachId == coachId.Value);

        if (group is null)
        {
            return NotFound(new
            {
                message = "Group not found."
            });
        }

        if (group.IsArchived)
        {
            return BadRequest(new
            {
                message = "Group is already archived."
            });
        }

        group.IsArchived = true;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Group archived.",
            group.TrainingGroupId,
            group.IsArchived
        });
    }

    [HttpPost("{id:int}/restore")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> RestoreGroup(int id)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var group = await _db.TrainingGroups
            .FirstOrDefaultAsync(g =>
                g.TrainingGroupId == id &&
                g.CoachId == coachId.Value);

        if (group is null)
        {
            return NotFound(new
            {
                message = "Group not found."
            });
        }

        if (!group.IsArchived)
        {
            return BadRequest(new
            {
                message = "Group is not archived."
            });
        }

        group.IsArchived = false;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Group restored.",
            group.TrainingGroupId,
            group.IsArchived
        });
    }

    // ==============================
    // ATHLETE PROFILES
    // ==============================

    // Создание профиля спортсмена без аккаунта.
    [HttpPost("athletes")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> CreateAthleteProfile(
        CreateAthleteProfileDto dto)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var name = dto.Name.Trim();
        var surname = dto.Surname.Trim();

        if (string.IsNullOrWhiteSpace(name) ||
            string.IsNullOrWhiteSpace(surname))
        {
            return BadRequest(new
            {
                message = "Name and surname are required."
            });
        }

        var profile = new AthleteProfile
        {
            Name = name,
            Surname = surname,
            Gender = dto.Gender,
            BeltColor = dto.BeltColor?.Trim(),
            WeightCategory = dto.WeightCategory,
            CreatedByUserId = coachId.Value,
            UserId = null,
            IsArchived = false
        };

        _db.AthleteProfiles.Add(profile);

        await _db.SaveChangesAsync();

        return Created(
            $"/api/Groups/athletes/{profile.AthleteProfileId}",
            new
            {
                AthleteId = profile.AthleteProfileId,
                profile.AthleteProfileId,
                profile.Name,
                profile.Surname,
                profile.Gender,
                profile.BeltColor,
                profile.WeightCategory,
                profile.IsArchived
            });
    }

    [HttpGet("athletes/available")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> GetAvailableAthletes()
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var athletes = await GetVisibleAthleteProfiles(coachId.Value)
            .AsNoTracking()
            .Where(a => !a.IsArchived)
            .OrderBy(a => a.Surname)
            .ThenBy(a => a.Name)
            .Select(a => new
            {
                AthleteId = a.AthleteProfileId,
                a.AthleteProfileId,
                a.Name,
                a.Surname,
                Email = a.User != null ? a.User.Email : null
            })
            .ToListAsync();

        return Ok(athletes);
    }

    [HttpGet("athletes/archived")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> GetArchivedAthletes()
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var athletes = await GetVisibleAthleteProfiles(coachId.Value)
            .AsNoTracking()
            .Where(a => a.IsArchived)
            .OrderBy(a => a.Surname)
            .ThenBy(a => a.Name)
            .Select(a => new
            {
                AthleteId = a.AthleteProfileId,
                a.AthleteProfileId,
                a.Name,
                a.Surname,
                Email = a.User != null ? a.User.Email : null
            })
            .ToListAsync();

        return Ok(athletes);
    }

    [HttpDelete("athletes/{athleteId:int}/archive")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> ArchiveAthlete(int athleteId)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var athlete = await _db.AthleteProfiles
            .FirstOrDefaultAsync(a =>
                a.AthleteProfileId == athleteId);

        if (athlete is null)
        {
            return NotFound(new
            {
                message = "Athlete not found."
            });
        }

        var belongsToCoach = await _db.GroupMemberships
            .AnyAsync(m =>
                m.AthleteProfileId == athleteId &&
                m.LeftDate == null &&
                m.TrainingGroup.CoachId == coachId.Value &&
                !m.TrainingGroup.IsArchived);

        var createdByCoach =
            athlete.CreatedByUserId == coachId.Value;

        if (!belongsToCoach && !createdByCoach)
        {
            return NotFound(new
            {
                message = "Athlete not found."
            });
        }

        if (athlete.IsArchived)
        {
            return BadRequest(new
            {
                message = "Athlete is already archived."
            });
        }

        athlete.IsArchived = true;

        // Закрываем активное членство во всех группах,
        // сохраняя историю.
        var activeMemberships = await _db.GroupMemberships
            .Where(m =>
                m.AthleteProfileId == athleteId &&
                m.LeftDate == null)
            .ToListAsync();

        var now = DateTime.UtcNow;

        foreach (var membership in activeMemberships)
        {
            membership.LeftDate = now;
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Athlete archived.",
            AthleteId = athlete.AthleteProfileId,
            athlete.IsArchived
        });
    }

    [HttpPost("athletes/{athleteId:int}/restore")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> RestoreAthlete(int athleteId)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var athlete = await _db.AthleteProfiles
            .FirstOrDefaultAsync(a =>
                a.AthleteProfileId == athleteId);

        if (athlete is null)
        {
            return NotFound(new
            {
                message = "Athlete not found."
            });
        }

        var hasMembershipHistory = await _db.GroupMemberships
            .AnyAsync(m =>
                m.AthleteProfileId == athleteId &&
                m.TrainingGroup.CoachId == coachId.Value);

        var createdByCoach =
            athlete.CreatedByUserId == coachId.Value;

        if (!hasMembershipHistory && !createdByCoach)
        {
            return NotFound(new
            {
                message = "Athlete not found in your profile or group history."
            });
        }

        if (!athlete.IsArchived)
        {
            return BadRequest(new
            {
                message = "Athlete is not archived."
            });
        }

        athlete.IsArchived = false;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Athlete restored.",
            AthleteId = athlete.AthleteProfileId,
            athlete.IsArchived
        });
    }

    // ==============================
    // GROUP ATHLETES
    // ==============================

    [HttpGet("{id:int}/athletes/available")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> GetAvailableAthletesForGroup(int id)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var groupExists = await CoachOwnsActiveGroup(
            id,
            coachId.Value);

        if (!groupExists)
        {
            return NotFound(new
            {
                message = "Group not found."
            });
        }

        var activeAthleteIds = await _db.GroupMemberships
            .AsNoTracking()
            .Where(m =>
                m.TrainingGroupId == id &&
                m.LeftDate == null &&
                !m.AthleteProfile.IsArchived)
            .Select(m => m.AthleteProfileId)
            .ToListAsync();

        var availableAthletes = await GetVisibleAthleteProfiles(
                coachId.Value)
            .AsNoTracking()
            .Where(a =>
                !a.IsArchived &&
                !activeAthleteIds.Contains(a.AthleteProfileId))
            .OrderBy(a => a.Surname)
            .ThenBy(a => a.Name)
            .Select(a => new
            {
                AthleteId = a.AthleteProfileId,
                a.AthleteProfileId,
                a.Name,
                a.Surname,
                Email = a.User != null ? a.User.Email : null
            })
            .ToListAsync();

        return Ok(availableAthletes);
    }

    [HttpGet("{id:int}/athletes")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> GetGroupAthletes(int id)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var groupExists = await CoachOwnsActiveGroup(
            id,
            coachId.Value);

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
                m.LeftDate == null &&
                !m.AthleteProfile.IsArchived)
            .OrderBy(m => m.AthleteProfile.Surname)
            .ThenBy(m => m.AthleteProfile.Name)
            .Select(m => new
            {
                AthleteId = m.AthleteProfileId,
                m.AthleteProfileId,
                m.AthleteProfile.Name,
                m.AthleteProfile.Surname,
                Email = m.AthleteProfile.User != null
                    ? m.AthleteProfile.User.Email
                    : null,
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

        var groupExists = await CoachOwnsActiveGroup(
            id,
            coachId.Value);

        if (!groupExists)
        {
            return NotFound(new
            {
                message = "Group not found."
            });
        }

        var membership = await _db.GroupMemberships
            .FirstOrDefaultAsync(m =>
                m.TrainingGroupId == id &&
                m.AthleteProfileId == athleteId &&
                m.LeftDate == null);

        if (membership is null)
        {
            return NotFound(new
            {
                message = "Active athlete membership not found."
            });
        }

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

        var groupExists = await CoachOwnsActiveGroup(
            id,
            coachId.Value);

        if (!groupExists)
        {
            return NotFound(new
            {
                message = "Group not found."
            });
        }

        var athlete = await _db.AthleteProfiles
            .FirstOrDefaultAsync(a =>
                a.AthleteProfileId == dto.AthleteId &&
                !a.IsArchived);

        if (athlete is null)
        {
            return NotFound(new
            {
                message = "Active athlete profile not found."
            });
        }

        var isVisibleToCoach =
            athlete.CreatedByUserId == coachId.Value ||
            athlete.UserId != null ||
            await _db.GroupMemberships.AnyAsync(m =>
                m.AthleteProfileId == athlete.AthleteProfileId &&
                m.TrainingGroup.CoachId == coachId.Value);

        if (!isVisibleToCoach)
        {
            return NotFound(new
            {
                message = "Athlete profile not found."
            });
        }

        var alreadyMember = await _db.GroupMemberships
            .AnyAsync(m =>
                m.TrainingGroupId == id &&
                m.AthleteProfileId == dto.AthleteId &&
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

        var membership = new GroupMembership
        {
            TrainingGroupId = id,
            AthleteProfileId = dto.AthleteId,
            JoinedDate = now
        };

        _db.GroupMemberships.Add(membership);

        var futureTrainings = await _db.Trainings
            .Where(t =>
                t.TrainingGroupId == id &&
                t.Status == TrainingStatus.Planned &&
                (t.Date.Date > today ||
                 (t.Date.Date == today &&
                  t.StartTime > currentTime)))
            .Select(t => t.TrainingId)
            .ToListAsync();

        var existingTrainingIds = await _db.TrainingParticipants
            .Where(p =>
                p.AthleteProfileId == dto.AthleteId &&
                futureTrainings.Contains(p.TrainingId))
            .Select(p => p.TrainingId)
            .ToListAsync();

        var existingIds = existingTrainingIds.ToHashSet();

        var newParticipants = futureTrainings
            .Where(trainingId => !existingIds.Contains(trainingId))
            .Select(trainingId => new TrainingParticipant
            {
                TrainingId = trainingId,
                AthleteProfileId = dto.AthleteId,
                Status = AttendanceStatus.Unmarked
            })
            .ToList();

        if (newParticipants.Count > 0)
            _db.TrainingParticipants.AddRange(newParticipants);

        await _db.SaveChangesAsync();

        return Created(
            $"/api/Groups/{id}",
            new
            {
                membership.GroupMembershipId,
                membership.TrainingGroupId,
                AthleteId = membership.AthleteProfileId,
                membership.AthleteProfileId,
                membership.JoinedDate,
                AddedToFutureTrainings = newParticipants.Count
            });
    }
}
