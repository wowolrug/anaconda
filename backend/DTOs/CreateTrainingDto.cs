using System.ComponentModel.DataAnnotations;
using backend.Models;

namespace backend.DTOs;

public class CreateTrainingDto
{
    [Required]
    public DateTime Date { get; set; }

    [Required]
    public TimeOnly StartTime { get; set; }

    [Required]
    public TimeOnly EndTime { get; set; }

    [Required]
    public TrainingType Type { get; set; }

    public int? TrainingGroupId { get; set; }

    [StringLength(1000)]
    public string? Description { get; set; }
}