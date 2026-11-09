
using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class CoachRegisterDto
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
    [StringLength(100)]
    public string InvitationCode { get; set; } = string.Empty;
}
