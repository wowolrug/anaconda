
namespace backend.Models;

public class GroupMembership
{
    public int GroupMembershipId { get; set; }
    public int TrainingGroupId { get; set; }
    public int AthleteId { get; set; }
    public DateTime JoinedDate { get; set; } = DateTime.UtcNow;
    public DateTime? LeftDate { get; set; }

    public TrainingGroup TrainingGroup { get; set; } = null!;
    public User Athlete { get; set; } = null!;
}
