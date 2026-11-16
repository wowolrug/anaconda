
using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace backend.DTOs;

public class RegisterDto : IValidatableObject
{
    [Required(ErrorMessage = "Введи имя.")]
    [StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Введи фамилию.")]
    [StringLength(100, MinimumLength = 1)]
    public string Surname { get; set; } = string.Empty;

    [Required(ErrorMessage = "Введи электронную почту.")]
    [EmailAddress(ErrorMessage = "Введи корректный адрес электронной почты.")]
    [StringLength(254)]
    public string Email { get; set; } = string.Empty;

    [Phone]
    [StringLength(30)]
    public string? PhoneNumber { get; set; }

    [Required(ErrorMessage = "Введи пароль.")]
    [MinLength(6, ErrorMessage = "Пароль должен содержать не менее 6 символов.")]
    [MaxLength(128, ErrorMessage = "Пароль не должен превышать 128 символов.")]
    public string Password { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(Coach|Athlete|Parent)$",
        ErrorMessage = "Role must be Coach, Athlete or Parent.")]
    public string Role { get; set; } = string.Empty;

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(PhoneNumber))
            yield break;

        var phone = PhoneNumber.Trim();

        if (!Regex.IsMatch(phone, @"^\+?[0-9\s().-]+$"))
        {
            yield return new ValidationResult(
                "Введи корректный номер телефона.",
                new[] { nameof(PhoneNumber) });

            yield break;
        }

        var digitsCount = phone.Count(char.IsDigit);

        if (digitsCount < 7 || digitsCount > 15)
        {
            yield return new ValidationResult(
                "Номер телефона должен содержать от 7 до 15 цифр.",
                new[] { nameof(PhoneNumber) });
        }
    }
}
