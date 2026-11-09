
using System.ComponentModel.DataAnnotations;
using backend.Models;

namespace backend.DTOs;

public class CreatePhysicalMeasurementDto
{
    [Required]
    public MeasurementType Type { get; set; }

    public decimal Value { get; set; }

    public DateTime? MeasuredAt { get; set; }

    [StringLength(1000)]
    public string? Note { get; set; }
}
