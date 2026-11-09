
namespace backend.Models;

public class AthleteProfile
{
    public int UserId { get; set; }
    public Gender Gender { get; set; }
    public string? BeltColor { get; set; }
    public WeightClass WeightCategory { get; set; } = WeightClass.Unspecified;

    public User User { get; set; } = null!;
}
