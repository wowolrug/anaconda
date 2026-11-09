
using System.ComponentModel.DataAnnotations;
using backend.Models;

namespace backend.DTOs;

public class UpdateAttendanceDto
{
    [Required]
    public AttendanceStatus Status { get; set; }

    [StringLength(1000)]
    public string? Note { get; set; }
}
