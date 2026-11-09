using backend.Models;
using Microsoft.AspNetCore.Identity;

namespace backend.Data;

public static class DevelopmentSeeder
{
    public static async Task SeedCoachAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();

        var serviceProvider = scope.ServiceProvider;

        var userManager =
            serviceProvider.GetRequiredService<UserManager<User>>();

        const string email = "coach.test@example.com";
        const string password = "CoachPass123!";

        var user = await userManager.FindByEmailAsync(email);

        if (user is null)
        {
            user = new User
            {
                UserName = email,
                Email = email,
                Name = "Test",
                Surname = "Coach",
                EmailConfirmed = true
            };

            var createResult =
                await userManager.CreateAsync(user, password);

            if (!createResult.Succeeded)
            {
                var errors = string.Join(
                    "; ",
                    createResult.Errors.Select(e => e.Description));

                throw new InvalidOperationException(
                    $"Could not create development coach: {errors}");
            }
        }

        if (!await userManager.IsInRoleAsync(user, "Coach"))
        {
            var roleResult =
                await userManager.AddToRoleAsync(user, "Coach");

            if (!roleResult.Succeeded)
            {
                var errors = string.Join(
                    "; ",
                    roleResult.Errors.Select(e => e.Description));

                throw new InvalidOperationException(
                    $"Could not assign Coach role: {errors}");
            }
        }
    }
}
