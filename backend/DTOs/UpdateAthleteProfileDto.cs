
using System.ComponentModel.DataAnnotations;
using backend.Models;

namespace backend.DTOs;

public class UpdateAthleteProfileDto
{
    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string Surname { get; set; } = string.Empty;

    public Gender Gender { get; set; }

    public DateTime? DateOfBirth { get; set; }

    [StringLength(100)]
    public string? BeltColor { get; set; }

    public WeightClass WeightCategory { get; set; }
        = WeightClass.Unspecified;
}
