using System.ComponentModel.DataAnnotations;

namespace backend.DTOs;

public class CreateGroupMetricMeasurementDto
{
    [Range(0.01, 99999999)]
    public decimal Value { get; set; }

    public DateTime? MeasuredAt { get; set; }

    [StringLength(1000)]
    public string? Note { get; set; }
}