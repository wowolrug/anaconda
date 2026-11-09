
using Microsoft.AspNetCore.Identity;

namespace backend.Models;

public class User : IdentityUser<int>
{
    public string Name { get; set; } = string.Empty;
    public string Surname { get; set; } = string.Empty;

    public AthleteProfile? AthleteProfile { get; set; }
                                                                
    public ICollection<ParentAthlete> Children { get; set; } = new List<ParentAthlete>();
    public ICollection<ParentAthlete> Parents { get; set; } = new List<ParentAthlete>();

    public ICollection<GroupMembership> GroupMemberships { get; set; } = new List<GroupMembership>();
    public ICollection<Training> CoachedTrainings { get; set; } = new List<Training>();
    public ICollection<TrainingParticipant> TrainingParticipations { get; set; } = new List<TrainingParticipant>();

    public ICollection<PhysicalMeasurement> Measurements { get; set; } = new List<PhysicalMeasurement>();
    public ICollection<PhysicalMeasurement> RecordedMeasurements { get; set; } = new List<PhysicalMeasurement>();

    public ICollection<AthleteNote> AthleteNotes { get; set; } = new List<AthleteNote>();
    public ICollection<AthleteNote> WrittenNotes { get; set; } = new List<AthleteNote>();
}
