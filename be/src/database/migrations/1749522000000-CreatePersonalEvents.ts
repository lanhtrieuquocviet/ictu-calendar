import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePersonalEvents1749522000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`personal_events\` (
        \`id\`            varchar(36)   NOT NULL,
        \`userId\`        varchar(36)   NOT NULL,
        \`googleEventId\` varchar(255)  NULL,
        \`title\`         varchar(255)  NOT NULL,
        \`eventDate\`     date          NOT NULL,
        \`startTime\`     time          NULL,
        \`endTime\`       time          NULL,
        \`allDay\`        tinyint       NOT NULL DEFAULT 0,
        \`location\`      varchar(255)  NULL,
        \`description\`   text          NULL,
        \`color\`         varchar(50)   NULL,
        \`syncedAt\`      timestamp     NULL,
        \`createdAt\`     datetime(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`     datetime(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                                 ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`IDX_personal_events_userId_googleEventId\` (\`userId\`, \`googleEventId\`),
        CONSTRAINT \`FK_personal_events_userId\`
          FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`personal_events\``);
  }
}
