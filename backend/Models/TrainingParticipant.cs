
namespace backend.Models;

public class TrainingParticipant
{
    public int TrainingParticipantId { get; set; }
    public int TrainingId { get; set; }
    public int AthleteId { get; set; }

    public AttendanceStatus Status { get; set; } = AttendanceStatus.Unmarked;
    public string? Note { get; set; }

    public Training Training { get; set; } = null!;
    public User Athlete { get; set; } = null!;
}
