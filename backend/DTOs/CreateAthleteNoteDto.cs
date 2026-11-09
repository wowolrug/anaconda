
using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class CreateAthleteNoteDto
{
    [Required]
    [StringLength(5000, MinimumLength = 1)]
    public string Text { get; set; } = string.Empty;

    public int? TrainingId { get; set; }
}
