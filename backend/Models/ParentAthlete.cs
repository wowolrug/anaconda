
namespace backend.Models;

public class ParentAthlete
{
    public int ParentId { get; set; }
    public int AthleteId { get; set; }
    public DateTime LinkedDate { get; set; } = DateTime.UtcNow;

    public User Parent { get; set; } = null!;
    public User Athlete { get; set; } = null!;
}
