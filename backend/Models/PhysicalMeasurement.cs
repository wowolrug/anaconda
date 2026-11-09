namespace backend.Models;

public class PhysicalMeasurement
{
    public int PhysicalMeasurementId { get; set; }

    public int AthleteId { get; set; }

    public int RecordedByUserId { get; set; }

    // Используется для старых измерений.
    // Для новых пользовательских показателей будет null.
    public MeasurementType? Type { get; set; }

    // Ссылка на показатель, созданный тренером для группы.
    public int? GroupMetricId { get; set; }

    public decimal Value { get; set; }

    public DateTime MeasuredAt { get; set; } = DateTime.UtcNow;

    public string? Note { get; set; }

    public User Athlete { get; set; } = null!;

    public User RecordedByUser { get; set; } = null!;

    public GroupMetric? GroupMetric { get; set; }
}