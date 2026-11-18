
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
public class AthleteProfilesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public AthleteProfilesController(ApplicationDbContext db)
    {
        _db = db;
    }

    // GET: api/AthleteProfiles/5
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetAthleteProfile(int id)
    {
        var athlete = await _db.AthleteProfiles
            .AsNoTracking()
            .Where(x => x.AthleteProfileId == id)
            .Select(x => new
            {
                x.AthleteProfileId,
                x.Name,
                x.Surname,
                x.Gender,
                x.DateOfBirth,
                x.BeltColor,
                x.WeightCategory
            })
            .FirstOrDefaultAsync();

        if (athlete == null)
            return NotFound(new { message = "Спортсмен не найден." });

        var age = athlete.DateOfBirth.HasValue
            ? CalculateAge(athlete.DateOfBirth.Value)
            : (int?)null;

        return Ok(new
        {
            athlete.AthleteProfileId,
            athlete.Name,
            athlete.Surname,
            athlete.Gender,
            athlete.DateOfBirth,
            Age = age,
            athlete.BeltColor,
            athlete.WeightCategory
        });
    }

    // PUT: api/AthleteProfiles/5
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Coach,MainCoach")]
    public async Task<IActionResult> UpdateAthleteProfile(
        int id,
        [FromBody] UpdateAthleteProfileDto dto)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var coachId))
            return Unauthorized();

        var hasAccess = await _db.GroupMemberships
            .AnyAsync(x =>
                x.AthleteProfileId == id &&
                x.LeftDate == null &&
                x.TrainingGroup.CoachId == coachId &&
                !x.TrainingGroup.IsArchived);

        if (!hasAccess)
        {
            return NotFound(new
            {
                message = "Спортсмен не найден или у вас нет доступа к его профилю."
            });
        }

        var athlete = await _db.AthleteProfiles
            .FirstOrDefaultAsync(x => x.AthleteProfileId == id);

        if (athlete == null)
            return NotFound(new { message = "Спортсмен не найден." });

        if (dto.DateOfBirth.HasValue &&
            (dto.DateOfBirth.Value.Date > DateTime.UtcNow.Date ||
             dto.DateOfBirth.Value.Date < new DateTime(1900, 1, 1)))
        {
            return BadRequest(new
            {
                message = "Укажите корректную дату рождения."
            });
        }

        athlete.Name = dto.Name.Trim();
        athlete.Surname = dto.Surname.Trim();
        athlete.Gender = dto.Gender;
        athlete.DateOfBirth = dto.DateOfBirth.HasValue
        ? DateTime.SpecifyKind(dto.DateOfBirth.Value.Date, DateTimeKind.Utc)
        : null;
        athlete.BeltColor = string.IsNullOrWhiteSpace(dto.BeltColor)
            ? null
            : dto.BeltColor.Trim();
        athlete.WeightCategory = dto.WeightCategory;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Данные спортсмена успешно обновлены.",
            athlete.AthleteProfileId,
            athlete.Name,
            athlete.Surname,
            athlete.Gender,
            athlete.DateOfBirth,
            Age = athlete.DateOfBirth.HasValue
                ? CalculateAge(athlete.DateOfBirth.Value)
                : (int?)null,
            athlete.BeltColor,
            athlete.WeightCategory
        });
    }

    private static int CalculateAge(DateTime dateOfBirth)
    {
        var today = DateTime.UtcNow.Date;

        var age = today.Year - dateOfBirth.Year;

        if (dateOfBirth.Date > today.AddYears(-age))
            age--;

        return age;
    }
}
