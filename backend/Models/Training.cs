
namespace backend.Models;

public class Training
{
    public int TrainingId { get; set; }
    public int CoachId { get; set; }
    public int? TrainingGroupId { get; set; }

    public DateTime Date { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }

    public TrainingType Type { get; set; }
    public TrainingStatus Status { get; set; } = TrainingStatus.Planned;
    public string Description { get; set; } = string.Empty;

    public DateTime CreationTime { get; set; } = DateTime.UtcNow;
    public DateTime? EditTime { get; set; }

    public User Coach { get; set; } = null!;
    public TrainingGroup? TrainingGroup { get; set; }

    public ICollection<TrainingParticipant> Participants { get; set; } = new List<TrainingParticipant>();
    public ICollection<AthleteNote> Notes { get; set; } = new List<AthleteNote>();
}
