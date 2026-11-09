
namespace backend.DTOs;

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;

    public int UserId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Surname { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    // Для совместимости с существующей логикой приложения.
    // Главный тренер также будет получать роль Coach.
    public string Role { get; set; } = string.Empty;

    // Дополнительный признак главного тренера.
    public bool IsMainCoach { get; set; }
}
