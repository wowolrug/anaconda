
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<User> _userManager;
    private readonly IConfiguration _configuration;
    private readonly ApplicationDbContext _db;

    private readonly PasswordHasher<CoachRegistrationSettings>
        _invitationCodeHasher = new();

    public AuthController(
        UserManager<User> userManager,
        IConfiguration configuration,
        ApplicationDbContext db)
    {
        _userManager = userManager;
        _configuration = configuration;
        _db = db;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        // Публичная регистрация разрешена только спортсменам
        // и родителям. Тренеры регистрируются отдельно по коду.
        if (dto.Role != "Athlete" && dto.Role != "Parent")
        {
            return BadRequest(new
            {
                message = "Public registration is allowed only for Athlete and Parent."
            });
        }

        var email = dto.Email.Trim();

        var existingUser = await _userManager.FindByEmailAsync(email);

        if (existingUser is not null)
        {
            return BadRequest(new
            {
                message = "A user with this email already exists."
            });
        }

        var user = new User
        {
            UserName = email,
            Email = email,
            Name = dto.Name.Trim(),
            Surname = dto.Surname.Trim()
        };

        var createResult = await _userManager.CreateAsync(
            user,
            dto.Password);

        if (!createResult.Succeeded)
        {
            return BadRequest(new
            {
                errors = createResult.Errors.Select(e => e.Description)
            });
        }

        var roleResult = await _userManager.AddToRoleAsync(
            user,
            dto.Role);

        if (!roleResult.Succeeded)
        {
            await _userManager.DeleteAsync(user);

            return StatusCode(500, new
            {
                message = "Could not assign the user role."
            });
        }

        return Ok(new
        {
            message = "Registration successful.",
            userId = user.Id
        });
    }

    [HttpPost("register-coach")]
    public async Task<IActionResult> RegisterCoach(CoachRegisterDto dto)
    {
        // Получаем настройки регистрации.
        var settings = await _db.CoachRegistrationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == 1);

        // Регистрация невозможна, если она выключена
        // или действующий код ещё не установлен.
        if (settings is null ||
            !settings.IsRegistrationEnabled ||
            string.IsNullOrWhiteSpace(settings.InvitationCodeHash))
        {
            return BadRequest(new
            {
                message = "Coach registration is currently unavailable."
            });
        }

        // Проверяем введённый код по сохранённому хешу.
        var verificationResult = _invitationCodeHasher.VerifyHashedPassword(
            settings,
            settings.InvitationCodeHash,
            dto.InvitationCode.Trim());

        if (verificationResult == PasswordVerificationResult.Failed)
        {
            return BadRequest(new
            {
                message = "Invalid invitation code."
            });
        }

        var email = dto.Email.Trim();

        var existingUser = await _userManager.FindByEmailAsync(email);

        if (existingUser is not null)
        {
            return BadRequest(new
            {
                message = "A user with this email already exists."
            });
        }

        // Создаём пользователя.
        var user = new User
        {
            UserName = email,
            Email = email,
            Name = dto.Name.Trim(),
            Surname = dto.Surname.Trim()
        };

        var createResult = await _userManager.CreateAsync(
            user,
            dto.Password);

        if (!createResult.Succeeded)
        {
            return BadRequest(new
            {
                errors = createResult.Errors.Select(e => e.Description)
            });
        }

        // Назначаем только роль Coach.
        var roleResult = await _userManager.AddToRoleAsync(
            user,
            "Coach");

        if (!roleResult.Succeeded)
        {
            await _userManager.DeleteAsync(user);

            return StatusCode(500, new
            {
                message = "Could not assign the Coach role."
            });
        }

        return Ok(new
        {
            message = "Coach registration successful.",
            userId = user.Id
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var user = await _userManager.FindByEmailAsync(
            dto.Email.Trim());

        var passwordIsValid = user is not null &&
            await _userManager.CheckPasswordAsync(user, dto.Password);

        if (!passwordIsValid || user is null)
        {
            return Unauthorized(new
            {
                message = "Invalid email or password."
            });
        }

        var roles = await _userManager.GetRolesAsync(user);

        if (roles.Count == 0)
        {
            return Unauthorized(new
            {
                message = "The user has no assigned role."
            });
        }

        var isMainCoach = roles.Contains("MainCoach");

        // Главный тренер получает все обычные возможности тренера.
        var jwtRoles = roles.ToList();

        if (isMainCoach && !jwtRoles.Contains("Coach"))
        {
            jwtRoles.Add("Coach");
        }

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.UserName ?? user.Email ?? ""),
            new(JwtRegisteredClaimNames.Email, user.Email ?? ""),
            new("name", user.Name),
            new("surname", user.Surname)
        };

        foreach (var role in jwtRoles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var key = _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException(
                "JWT key is not configured.");

        var issuer = _configuration["Jwt:Issuer"]
            ?? throw new InvalidOperationException(
                "JWT issuer is not configured.");

        var audience = _configuration["Jwt:Audience"]
            ?? throw new InvalidOperationException(
                "JWT audience is not configured.");

        var signingKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(key));

        var credentials = new SigningCredentials(
            signingKey,
            SecurityAlgorithms.HmacSha256);

        var expiresAt = DateTime.UtcNow.AddHours(2);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        var tokenString = new JwtSecurityTokenHandler()
            .WriteToken(token);

        return Ok(new AuthResponseDto
        {
            Token = tokenString,
            UserId = user.Id,
            Name = user.Name,
            Surname = user.Surname,
            Email = user.Email ?? "",
            Role = isMainCoach || roles.Contains("Coach")
                ? "Coach"
                : roles[0],
            IsMainCoach = isMainCoach
        });
    }
}
