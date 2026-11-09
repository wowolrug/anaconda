using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class CreateGroupDto
{
    [Required]
    [StringLength(150, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }
}