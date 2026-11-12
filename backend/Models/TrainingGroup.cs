namespace backend.Models;

public class TrainingGroup
{
    public int TrainingGroupId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public int CoachId { get; set; }

    public User Coach { get; set; } = null!;

    public bool IsArchived { get; set; } = false;

    public ICollection<GroupMembership> Memberships { get; set; }
        = new List<GroupMembership>();

    public ICollection<Training> Trainings { get; set; }
        = new List<Training>();

    public ICollection<GroupMetric> Metrics { get; set; }
        = new List<GroupMetric>();
}