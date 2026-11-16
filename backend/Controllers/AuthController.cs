
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
        if (dto.Role != "Athlete" && dto.Role != "Parent")
        {
            return BadRequest(new
            {
                message = "Public registration is allowed only for Athlete and Parent."
            });
        }

        var email = dto.Email.Trim();
        var name = dto.Name.Trim();
        var surname = dto.Surname.Trim();

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
            Name = name,
            Surname = surname,
            PhoneNumber = string.IsNullOrWhiteSpace(dto.PhoneNumber)
                ? null
                : dto.PhoneNumber.Trim()
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

        int? athleteProfileId = null;
        var profileLinked = false;
        var profileLinkStatus = (string?)null;

        if (dto.Role == "Athlete")
        {
            try
            {
                var normalizedName = name.ToLower();
                var normalizedSurname = surname.ToLower();

                // Ищем свободные профили с совпадающими именем и фамилией.
                // Берём максимум два, чтобы определить неоднозначность.
                var matchingProfiles = await _db.AthleteProfiles
                    .Where(x =>
                        x.UserId == null &&
                        x.Name.Trim().ToLower() == normalizedName &&
                        x.Surname.Trim().ToLower() == normalizedSurname)
                    .Take(2)
                    .ToListAsync();

                if (matchingProfiles.Count == 1)
                {
                    // Найден ровно один профиль — привязываем аккаунт к нему.
                    var existingProfile = matchingProfiles[0];

                    existingProfile.UserId = user.Id;

                    athleteProfileId = existingProfile.AthleteProfileId;
                    profileLinked = true;
                    profileLinkStatus = "existing_profile_linked";
                }
                else
                {
                    // Нет совпадений или их несколько — создаём новый профиль.
                    var profile = new AthleteProfile
                    {
                        UserId = user.Id,
                        Name = name,
                        Surname = surname
                    };

                    _db.AthleteProfiles.Add(profile);

                    profileLinkStatus = matchingProfiles.Count == 0
                        ? "new_profile_created"
                        : "multiple_matches";
                }

                await _db.SaveChangesAsync();

                if (athleteProfileId == null)
                {
                    var createdProfile = await _db.AthleteProfiles
                        .FirstOrDefaultAsync(x => x.UserId == user.Id);

                    athleteProfileId = createdProfile?.AthleteProfileId;
                }
            }
            catch
            {
                await _userManager.DeleteAsync(user);

                return StatusCode(500, new
                {
                    message = "Could not create or link the athlete profile."
                });
            }
        }

        return Ok(new
        {
            message = "Registration successful.",
            userId = user.Id,
            athleteProfileId,
            profileLinked,
            profileLinkStatus
        });
    }

    [HttpPost("register-coach")]
    public async Task<IActionResult> RegisterCoach(CoachRegisterDto dto)
    {
        var settings = await _db.CoachRegistrationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == 1);

        if (settings is null ||
            !settings.IsRegistrationEnabled ||
            string.IsNullOrWhiteSpace(settings.InvitationCodeHash))
        {
            return BadRequest(new
            {
                message = "Coach registration is currently unavailable."
            });
        }

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

        var user = new User
        {
            UserName = email,
            Email = email,
            Name = dto.Name.Trim(),
            Surname = dto.Surname.Trim(),
            PhoneNumber = string.IsNullOrWhiteSpace(dto.PhoneNumber)
                ? null
                : dto.PhoneNumber.Trim()
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

        if (user.IsArchived)
        {
            return Unauthorized(new
            {
                message = "This account has been archived."
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

        var expiresAt = DateTime.UtcNow.AddYears(2);

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
