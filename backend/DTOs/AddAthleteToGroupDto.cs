using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class AddAthleteToGroupDto
{
    [Required]
    [Range(1, int.MaxValue)]
    public int AthleteId { get; set; }
}