using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddCoachToTrainingGroup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CoachId",
                table: "TrainingGroups",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrainingGroups_CoachId",
                table: "TrainingGroups",
                column: "CoachId");

            migrationBuilder.AddForeignKey(
                name: "FK_TrainingGroups_AspNetUsers_CoachId",
                table: "TrainingGroups",
                column: "CoachId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TrainingGroups_AspNetUsers_CoachId",
                table: "TrainingGroups");

            migrationBuilder.DropIndex(
                name: "IX_TrainingGroups_CoachId",
                table: "TrainingGroups");

            migrationBuilder.DropColumn(
                name: "CoachId",
                table: "TrainingGroups");
        }
    }
}
