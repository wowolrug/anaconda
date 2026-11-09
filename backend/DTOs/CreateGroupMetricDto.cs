using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class CreateGroupMetricDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(30)]
    public string Unit { get; set; } = string.Empty;
}