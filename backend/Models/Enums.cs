
namespace backend.Models;

public enum Gender
{
    Male,
    Female
}

public enum WeightClass
{
    Unspecified,
    Underweight,
    Lightweight,
    Welterweight,
    Middleweight,
    LightHeavyweight,
    Heavyweight
}

public enum TrainingType
{
    Technique,
    Sparring,
    Strength,
    Cardio,
    Mixed,
    Other
}

public enum TrainingStatus
{
    Planned,
    InProgress,
    Completed,
    Cancelled
}

public enum AttendanceStatus
{
    Unmarked,
    Present,
    Absent,
    Late,
    Excused
}

public enum MeasurementType
{
    Weight,
    Height,
    ArmSpan
}

public enum NoteType
{
    Coach,
    Athlete,
    Parent
}
