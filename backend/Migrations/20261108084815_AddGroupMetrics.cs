using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupMetrics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "Type",
                table: "PhysicalMeasurements",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<int>(
                name: "GroupMetricId",
                table: "PhysicalMeasurements",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "GroupMetrics",
                columns: table => new
                {
                    GroupMetricId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TrainingGroupId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Unit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupMetrics", x => x.GroupMetricId);
                    table.ForeignKey(
                        name: "FK_GroupMetrics_TrainingGroups_TrainingGroupId",
                        column: x => x.TrainingGroupId,
                        principalTable: "TrainingGroups",
                        principalColumn: "TrainingGroupId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PhysicalMeasurements_AthleteId_GroupMetricId_MeasuredAt",
                table: "PhysicalMeasurements",
                columns: new[] { "AthleteId", "GroupMetricId", "MeasuredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PhysicalMeasurements_GroupMetricId",
                table: "PhysicalMeasurements",
                column: "GroupMetricId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupMetrics_TrainingGroupId_Name",
                table: "GroupMetrics",
                columns: new[] { "TrainingGroupId", "Name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_PhysicalMeasurements_GroupMetrics_GroupMetricId",
                table: "PhysicalMeasurements",
                column: "GroupMetricId",
                principalTable: "GroupMetrics",
                principalColumn: "GroupMetricId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PhysicalMeasurements_GroupMetrics_GroupMetricId",
                table: "PhysicalMeasurements");

            migrationBuilder.DropTable(
                name: "GroupMetrics");

            migrationBuilder.DropIndex(
                name: "IX_PhysicalMeasurements_AthleteId_GroupMetricId_MeasuredAt",
                table: "PhysicalMeasurements");

            migrationBuilder.DropIndex(
                name: "IX_PhysicalMeasurements_GroupMetricId",
                table: "PhysicalMeasurements");

            migrationBuilder.DropColumn(
                name: "GroupMetricId",
                table: "PhysicalMeasurements");

            migrationBuilder.AlterColumn<int>(
                name: "Type",
                table: "PhysicalMeasurements",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
