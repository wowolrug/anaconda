
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "MainCoach")]
public class CoachRegistrationController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    private readonly PasswordHasher<CoachRegistrationSettings>
        _codeHasher = new();

    public CoachRegistrationController(ApplicationDbContext db)
    {
        _db = db;
    }

    // Получить состояние регистрации.
    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        var settings = await GetOrCreateSettingsAsync();

        return Ok(new
        {
            isRegistrationEnabled = settings.IsRegistrationEnabled,
            hasInvitationCode = !string.IsNullOrWhiteSpace(
                settings.InvitationCodeHash),
            updatedAtUtc = settings.UpdatedAtUtc
        });
    }

    // Создать новый код или заменить старый.
    [HttpPut("invitation-code")]
    public async Task<IActionResult> SetInvitationCode(
        [FromBody] InvitationCodeDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code))
        {
            return BadRequest(new
            {
                message = "Invitation code cannot be empty."
            });
        }

        var code = dto.Code.Trim();

        if (code.Length < 6 || code.Length > 100)
        {
            return BadRequest(new
            {
                message = "Invitation code must contain between 6 and 100 characters."
            });
        }

        var settings = await GetOrCreateSettingsAsync();

        settings.InvitationCodeHash = _codeHasher.HashPassword(
            settings,
            code);

        settings.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Invitation code updated successfully."
        });
    }

    // Включить или отключить регистрацию.
    [HttpPut("registration-status")]
    public async Task<IActionResult> SetRegistrationStatus(
        [FromBody] RegistrationStatusDto dto)
    {
        var settings = await GetOrCreateSettingsAsync();

        if (dto.IsEnabled &&
            string.IsNullOrWhiteSpace(settings.InvitationCodeHash))
        {
            return BadRequest(new
            {
                message = "Set an invitation code before enabling registration."
            });
        }

        settings.IsRegistrationEnabled = dto.IsEnabled;
        settings.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = dto.IsEnabled
                ? "Coach registration enabled."
                : "Coach registration disabled.",
            isRegistrationEnabled = settings.IsRegistrationEnabled
        });
    }

    private async Task<CoachRegistrationSettings>
        GetOrCreateSettingsAsync()
    {
        var settings = await _db.CoachRegistrationSettings
            .FirstOrDefaultAsync(x => x.Id == 1);

        if (settings is not null)
        {
            return settings;
        }

        settings = new CoachRegistrationSettings
        {
            Id = 1,
            IsRegistrationEnabled = false,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _db.CoachRegistrationSettings.Add(settings);

        await _db.SaveChangesAsync();

        return settings;
    }
}

// DTO для создания или замены кода.
public class InvitationCodeDto
{
    public string Code { get; set; } = string.Empty;
}

// DTO для включения или отключения регистрации.
public class RegistrationStatusDto
{
    public bool IsEnabled { get; set; }
}
