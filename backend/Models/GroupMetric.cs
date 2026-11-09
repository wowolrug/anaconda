namespace backend.Models;

public class GroupMetric
{
    public int GroupMetricId { get; set; }

    public int TrainingGroupId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Unit { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public TrainingGroup TrainingGroup { get; set; } = null!;

    public ICollection<PhysicalMeasurement> Measurements { get; set; }
        = new List<PhysicalMeasurement>();
}