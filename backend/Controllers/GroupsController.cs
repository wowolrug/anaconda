
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

    private async Task<bool> CoachOwnsActiveGroup(
        int groupId,
        int coachId)
    {
        return await _db.TrainingGroups.AnyAsync(g =>
            g.TrainingGroupId == groupId &&
            g.CoachId == coachId &&
            !g.IsArchived);
    }

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
                         !m.Athlete.IsArchived)
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
                         !m.Athlete.IsArchived)
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
                         !m.Athlete.IsArchived)
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

    [HttpGet("athletes/available")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> GetAvailableAthletes()
    {
        var athletes = await _userManager.GetUsersInRoleAsync("Athlete");

        var result = athletes
            .Where(a => !a.IsArchived)
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

    [HttpGet("athletes/archived")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> GetArchivedAthletes()
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var athleteIds = await _db.GroupMemberships
            .AsNoTracking()
            .Where(m => m.TrainingGroup.CoachId == coachId.Value)
            .Select(m => m.AthleteId)
            .Distinct()
            .ToListAsync();

        var athletes = await _userManager.GetUsersInRoleAsync("Athlete");

        var result = athletes
            .Where(a =>
                a.IsArchived &&
                athleteIds.Contains(a.Id))
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

    [HttpDelete("athletes/{athleteId:int}/archive")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> ArchiveAthlete(int athleteId)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var athlete = await _userManager.FindByIdAsync(
            athleteId.ToString());

        if (athlete is null ||
            !await _userManager.IsInRoleAsync(athlete, "Athlete"))
        {
            return NotFound(new
            {
                message = "Athlete not found."
            });
        }

        var belongsToCoach = await _db.GroupMemberships
            .AnyAsync(m =>
                m.AthleteId == athleteId &&
                m.LeftDate == null &&
                m.TrainingGroup.CoachId == coachId.Value &&
                !m.TrainingGroup.IsArchived);

        if (!belongsToCoach)
        {
            return NotFound(new
            {
                message =
                    "Active athlete membership in your groups was not found."
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
        // сохраняя историю членства.
        var activeMemberships = await _db.GroupMemberships
            .Where(m =>
                m.AthleteId == athleteId &&
                m.LeftDate == null)
            .ToListAsync();

        var now = DateTime.UtcNow;

        foreach (var membership in activeMemberships)
        {
            membership.LeftDate = now;
        }

        var updateResult = await _userManager.UpdateAsync(athlete);

        if (!updateResult.Succeeded)
        {
            return BadRequest(new
            {
                errors = updateResult.Errors.Select(e => e.Description)
            });
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Athlete archived.",
            AthleteId = athlete.Id,
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

        var athlete = await _userManager.FindByIdAsync(
            athleteId.ToString());

        if (athlete is null ||
            !await _userManager.IsInRoleAsync(athlete, "Athlete"))
        {
            return NotFound(new
            {
                message = "Athlete not found."
            });
        }

        var hasMembershipHistory = await _db.GroupMemberships
            .AnyAsync(m =>
                m.AthleteId == athleteId &&
                m.TrainingGroup.CoachId == coachId.Value);

        if (!hasMembershipHistory)
        {
            return NotFound(new
            {
                message = "Athlete not found in your group history."
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

        var updateResult = await _userManager.UpdateAsync(athlete);

        if (!updateResult.Succeeded)
        {
            return BadRequest(new
            {
                errors = updateResult.Errors.Select(e => e.Description)
            });
        }

        return Ok(new
        {
            message = "Athlete restored.",
            AthleteId = athlete.Id,
            athlete.IsArchived
        });
    }

    [HttpGet("{id:int}/athletes/available")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> GetAvailableAthletesForGroup(int id)
    {
        var coachId = GetCurrentUserId();

        if (coachId is null)
            return Unauthorized();

        var groupExists = await CoachOwnsActiveGroup(id, coachId.Value);

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
                !m.Athlete.IsArchived)
            .Select(m => m.AthleteId)
            .ToListAsync();

        var allAthletes = await _userManager
            .GetUsersInRoleAsync("Athlete");

        var availableAthletes = allAthletes
            .Where(a =>
                !a.IsArchived &&
                !activeAthleteIds.Contains(a.Id))
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

        var groupExists = await CoachOwnsActiveGroup(id, coachId.Value);

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
                !m.Athlete.IsArchived)
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

        var groupExists = await CoachOwnsActiveGroup(id, coachId.Value);

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

        var groupExists = await CoachOwnsActiveGroup(id, coachId.Value);

        if (!groupExists)
        {
            return NotFound(new
            {
                message = "Group not found."
            });
        }

        var athlete = await _userManager.FindByIdAsync(
            dto.AthleteId.ToString());

        if (athlete is null ||
            athlete.IsArchived ||
            !await _userManager.IsInRoleAsync(athlete, "Athlete"))
        {
            return NotFound(new
            {
                message = "Active athlete not found."
            });
        }

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

        var membership = new GroupMembership
        {
            TrainingGroupId = id,
            AthleteId = dto.AthleteId,
            JoinedDate = now
        };

        _db.GroupMemberships.Add(membership);

        var futureTrainings = await _db.Trainings
            .Where(t =>
                t.TrainingGroupId == id &&
                t.Status == TrainingStatus.Planned &&
                (t.Date.Date > today ||
                (t.Date.Date == today && t.StartTime > currentTime)))
            .Select(t => t.TrainingId)
            .ToListAsync();

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
