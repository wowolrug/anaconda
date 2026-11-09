
using backend.Data;
using backend.DTOs;
using backend.Models;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TrainingsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    private static readonly TimeZoneInfo MoscowTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows()
                ? "Russian Standard Time"
                : "Europe/Moscow");

    public TrainingsController(ApplicationDbContext db)
    {
        _db = db;
    }

    private bool TryGetCurrentUserId(out int userId)
    {
        return int.TryParse(
            User.FindFirstValue(ClaimTypes.NameIdentifier),
            out userId);
    }

    private IQueryable<Training> ApplyAccessFilter(
        IQueryable<Training> query,
        int userId)
    {
        if (User.IsInRole("Coach"))
        {
            return query.Where(t => t.CoachId == userId);
        }

        if (User.IsInRole("Athlete"))
        {
            return query.Where(t =>
                t.Participants.Any(p => p.AthleteId == userId));
        }

        if (User.IsInRole("Parent"))
        {
            return query.Where(t =>
                t.Participants.Any(p =>
                    _db.ParentAthletes.Any(pa =>
                        pa.ParentId == userId &&
                        pa.AthleteId == p.AthleteId)));
        }

        return query.Where(t => false);
    }

    // Получаем текущее московское время.
    private static DateTime GetMoscowNow()
    {
        return TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.UtcNow,
            MoscowTimeZone);
    }

    // Рассчитываем актуальный статус тренировки.
    private static TrainingStatus GetActualStatus(
        Training training,
        DateTime moscowNow)
    {
        // Отменённая тренировка не меняет статус.
        if (training.Status == TrainingStatus.Cancelled)
            return TrainingStatus.Cancelled;

        // Дата тренировки хранится как UTC,
        // но сама дата обозначает календарный день по Москве.
        var trainingDate = DateTime.SpecifyKind(
            training.Date.Date,
            DateTimeKind.Unspecified);

        var startDateTime = trainingDate.Add(
            training.StartTime.ToTimeSpan());

        var endDateTime = trainingDate.Add(
            training.EndTime.ToTimeSpan());

        if (moscowNow < startDateTime)
            return TrainingStatus.Planned;

        if (moscowNow < endDateTime)
            return TrainingStatus.InProgress;

        return TrainingStatus.Completed;
    }

    [HttpGet]
    public async Task<IActionResult> GetTrainings(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? groupId)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        if (from.HasValue && to.HasValue &&
            from.Value > to.Value)
        {
            return BadRequest(new
            {
                message = "'from' must be earlier than or equal to 'to'."
            });
        }

        var query = ApplyAccessFilter(
            _db.Trainings.AsNoTracking(),
            userId);

        if (from.HasValue)
            query = query.Where(t => t.Date >= from.Value);

        if (to.HasValue)
            query = query.Where(t => t.Date <= to.Value);

        if (groupId.HasValue)
            query = query.Where(t =>
                t.TrainingGroupId == groupId.Value);

        var isCoach = User.IsInRole("Coach");

        var trainings = await query
            .OrderBy(t => t.Date)
            .ThenBy(t => t.StartTime)
            .Select(t => new
            {
                t.TrainingId,
                t.Date,
                t.StartTime,
                t.EndTime,
                t.Type,
                t.Status,
                t.Description,
                t.CoachId,
                CoachName = t.Coach.Name + " " + t.Coach.Surname,
                t.TrainingGroupId,
                GroupName = t.TrainingGroup != null
                    ? t.TrainingGroup.Name
                    : null,
                ParticipantsCount = isCoach
                    ? t.Participants.Count()
                    : 0
            })
            .ToListAsync();

        var moscowNow = GetMoscowNow();

        var result = trainings.Select(t =>
        {
            var training = new Training
            {
                Date = t.Date,
                StartTime = t.StartTime,
                EndTime = t.EndTime,
                Status = t.Status
            };

            return new
            {
                t.TrainingId,
                t.Date,
                t.StartTime,
                t.EndTime,
                t.Type,
                Status = GetActualStatus(training, moscowNow),
                t.Description,
                t.CoachId,
                t.CoachName,
                t.TrainingGroupId,
                t.GroupName,
                t.ParticipantsCount
            };
        });

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetTraining(int id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var query = ApplyAccessFilter(
            _db.Trainings.AsNoTracking(),
            userId);

        var isCoach = User.IsInRole("Coach");
        var moscowNow = GetMoscowNow();

        if (isCoach)
        {
            var trainingForCoach = await query
                .Where(t => t.TrainingId == id)
                .Select(t => new
                {
                    t.TrainingId,
                    t.Date,
                    t.StartTime,
                    t.EndTime,
                    t.Type,
                    t.Status,
                    t.Description,
                    t.CoachId,
                    CoachName = t.Coach.Name + " " + t.Coach.Surname,
                    t.TrainingGroupId,
                    GroupName = t.TrainingGroup != null
                        ? t.TrainingGroup.Name
                        : null,
                    Participants = t.Participants
                        .OrderBy(p => p.Athlete.Surname)
                        .Select(p => new
                        {
                            p.AthleteId,
                            p.Athlete.Name,
                            p.Athlete.Surname,
                            p.Status,
                            p.Note
                        })
                        .ToList()
                })
                .FirstOrDefaultAsync();

            if (trainingForCoach is null)
            {
                return NotFound(new
                {
                    message = "Training not found."
                });
            }

            var training = new Training
            {
                Date = trainingForCoach.Date,
                StartTime = trainingForCoach.StartTime,
                EndTime = trainingForCoach.EndTime,
                Status = trainingForCoach.Status
            };

            return Ok(new
            {
                trainingForCoach.TrainingId,
                trainingForCoach.Date,
                trainingForCoach.StartTime,
                trainingForCoach.EndTime,
                trainingForCoach.Type,
                Status = GetActualStatus(training, moscowNow),
                trainingForCoach.Description,
                trainingForCoach.CoachId,
                trainingForCoach.CoachName,
                trainingForCoach.TrainingGroupId,
                trainingForCoach.GroupName,
                trainingForCoach.Participants
            });
        }

        var trainingForUser = await query
            .Where(t => t.TrainingId == id)
            .Select(t => new
            {
                t.TrainingId,
                t.Date,
                t.StartTime,
                t.EndTime,
                t.Type,
                t.Status,
                t.Description,
                t.CoachId,
                CoachName = t.Coach.Name + " " + t.Coach.Surname,
                t.TrainingGroupId,
                GroupName = t.TrainingGroup != null
                    ? t.TrainingGroup.Name
                    : null
            })
            .FirstOrDefaultAsync();

        if (trainingForUser is null)
        {
            return NotFound(new
            {
                message = "Training not found."
            });
        }

        var userTraining = new Training
        {
            Date = trainingForUser.Date,
            StartTime = trainingForUser.StartTime,
            EndTime = trainingForUser.EndTime,
            Status = trainingForUser.Status
        };

        return Ok(new
        {
            trainingForUser.TrainingId,
            trainingForUser.Date,
            trainingForUser.StartTime,
            trainingForUser.EndTime,
            trainingForUser.Type,
            Status = GetActualStatus(userTraining, moscowNow),
            trainingForUser.Description,
            trainingForUser.CoachId,
            trainingForUser.CoachName,
            trainingForUser.TrainingGroupId,
            trainingForUser.GroupName
        });
    }

    [HttpPost]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> CreateTraining(
        CreateTrainingDto dto)
    {
        if (dto.EndTime <= dto.StartTime)
        {
            return BadRequest(new
            {
                message = "End time must be later than start time."
            });
        }

        if (!TryGetCurrentUserId(out var coachId))
            return Unauthorized();

        if (dto.TrainingGroupId.HasValue)
        {
            var groupBelongsToCoach = await _db.TrainingGroups
                .AnyAsync(g =>
                    g.TrainingGroupId == dto.TrainingGroupId.Value &&
                    g.CoachId == coachId);

            if (!groupBelongsToCoach)
            {
                return BadRequest(new
                {
                    message = "Training group was not found or does not belong to this coach."
                });
            }
        }

        var training = new Training
        {
            CoachId = coachId,
            TrainingGroupId = dto.TrainingGroupId,
            Date = DateTime.SpecifyKind(
                dto.Date,
                DateTimeKind.Utc),
            StartTime = dto.StartTime,
            EndTime = dto.EndTime,
            Type = dto.Type,
            Status = TrainingStatus.Planned,
            Description = dto.Description?.Trim() ?? string.Empty,
            CreationTime = DateTime.UtcNow
        };

        _db.Trainings.Add(training);
        await _db.SaveChangesAsync();

        if (training.TrainingGroupId.HasValue)
        {
            var athleteIds = await _db.GroupMemberships
                .Where(m =>
                    m.TrainingGroupId == training.TrainingGroupId.Value &&
                    m.LeftDate == null)
                .Select(m => m.AthleteId)
                .ToListAsync();

            var participants = athleteIds
                .Select(athleteId => new TrainingParticipant
                {
                    TrainingId = training.TrainingId,
                    AthleteId = athleteId,
                    Status = AttendanceStatus.Unmarked
                })
                .ToList();

            if (participants.Count > 0)
            {
                _db.TrainingParticipants.AddRange(participants);
                await _db.SaveChangesAsync();
            }
        }

        return CreatedAtAction(
            nameof(GetTraining),
            new { id = training.TrainingId },
            new
            {
                training.TrainingId,
                training.CoachId,
                training.TrainingGroupId,
                training.Date,
                training.StartTime,
                training.EndTime,
                training.Type,
                Status = GetActualStatus(training, GetMoscowNow()),
                training.Description,
                training.CreationTime
            });
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> UpdateTraining(
        int id,
        UpdateTrainingDto dto)
    {
        if (!TryGetCurrentUserId(out var coachId))
            return Unauthorized();

        if (dto.EndTime <= dto.StartTime)
        {
            return BadRequest(new
            {
                message = "End time must be later than start time."
            });
        }

        var training = await _db.Trainings
            .FirstOrDefaultAsync(t => t.TrainingId == id);

        if (training is null)
        {
            return NotFound(new
            {
                message = "Training is not found."
            });
        }

        if (training.CoachId != coachId)
            return Forbid();

        if (dto.TrainingGroupId.HasValue)
        {
            var groupBelongsToCoach = await _db.TrainingGroups
                .AnyAsync(g =>
                    g.TrainingGroupId == dto.TrainingGroupId.Value &&
                    g.CoachId == coachId);

            if (!groupBelongsToCoach)
            {
                return BadRequest(new
                {
                    message = "Training group was not found or does not belong to this coach."
                });
            }
        }

        training.Date = DateTime.SpecifyKind(
            dto.Date,
            DateTimeKind.Utc);

        training.StartTime = dto.StartTime;
        training.EndTime = dto.EndTime;
        training.Type = dto.Type;
        training.TrainingGroupId = dto.TrainingGroupId;
        training.Description = dto.Description?.Trim() ?? string.Empty;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Training updated.",
            training.TrainingId,
            training.CoachId,
            training.TrainingGroupId,
            training.Date,
            training.StartTime,
            training.EndTime,
            training.Type,
            Status = GetActualStatus(training, GetMoscowNow()),
            training.Description
        });
    }

    [HttpPut("{id:int}/cancel")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> CancelTraining(int id)
    {
        if (!TryGetCurrentUserId(out var coachId))
            return Unauthorized();

        var training = await _db.Trainings
            .FirstOrDefaultAsync(t => t.TrainingId == id);

        if (training is null)
        {
            return NotFound(new
            {
                message = "Training is not found."
            });
        }

        if (training.CoachId != coachId)
            return Forbid();

        if (training.Status == TrainingStatus.Cancelled)
        {
            return BadRequest(new
            {
                message = "Training is already cancelled."
            });
        }

        if (GetActualStatus(training, GetMoscowNow()) ==
            TrainingStatus.Completed)
        {
            return BadRequest(new
            {
                message = "Completed training cannot be cancelled."
            });
        }

        training.Status = TrainingStatus.Cancelled;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Training cancelled.",
            training.TrainingId,
            training.Status
        });
    }

    [HttpGet("{id:int}/attendance")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> GetAttendance(int id)
    {
        if (!TryGetCurrentUserId(out var coachId))
            return Unauthorized();

        var training = await _db.Trainings
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TrainingId == id);

        if (training is null)
        {
            return NotFound(new
            {
                message = "Training is not found."
            });
        }

        if (training.CoachId != coachId)
            return Forbid();

        var participants = await _db.TrainingParticipants
            .AsNoTracking()
            .Where(p => p.TrainingId == id)
            .OrderBy(p => p.Athlete.Surname)
            .ThenBy(p => p.Athlete.Name)
            .Select(p => new
            {
                p.AthleteId,
                p.Athlete.Name,
                p.Athlete.Surname,
                p.Status,
                p.Note
            })
            .ToListAsync();

        return Ok(participants);
    }

    [HttpPut("{id:int}/attendance/{athleteId:int}")]
    [Authorize(Roles = "Coach")]
    public async Task<IActionResult> UpdateAttendance(
        int id,
        int athleteId,
        UpdateAttendanceDto dto)
    {
        if (!TryGetCurrentUserId(out var coachId))
            return Unauthorized();

        var training = await _db.Trainings
            .FirstOrDefaultAsync(t => t.TrainingId == id);

        if (training is null)
        {
            return NotFound(new
            {
                message = "Training is not found."
            });
        }

        if (training.CoachId != coachId)
            return Forbid();

        if (!Enum.IsDefined(typeof(AttendanceStatus), dto.Status))
        {
            return BadRequest(new
            {
                message = "Invalid attendance status"
            });
        }

        var participant = await _db.TrainingParticipants
            .FirstOrDefaultAsync(p =>
                p.TrainingId == id &&
                p.AthleteId == athleteId);

        if (participant is null)
        {
            return NotFound(new
            {
                message = "Athlete is not assigned to this training."
            });
        }

        participant.Status = dto.Status;
        participant.Note = dto.Note?.Trim();

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Attendance updated.",
            TrainingId = id,
            AthleteId = athleteId,
            participant.Status,
            participant.Note
        });
    }
}
