
namespace backend.Models;

public class ParentAthlete
{
    public int ParentId { get; set; }
    public int AthleteProfileId { get; set; }

    public DateTime LinkedDate { get; set; } = DateTime.UtcNow;

    public User Parent { get; set; } = null!;
    public AthleteProfile AthleteProfile { get; set; } = null!;
}
