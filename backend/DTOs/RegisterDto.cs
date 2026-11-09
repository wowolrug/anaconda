using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class RegisterDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string Surname { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    public string Password { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(Coach|Athlete|Parent)$",
        ErrorMessage = "Role must be Coach, Athlete or Parent.")]
    public string Role { get; set; } = string.Empty;
}
