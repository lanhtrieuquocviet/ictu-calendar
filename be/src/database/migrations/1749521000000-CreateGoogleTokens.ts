import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGoogleTokens1749521000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`google_tokens\` (
        \`id\`           varchar(36)   NOT NULL,
        \`userId\`       varchar(36)   NOT NULL,
        \`accessToken\`  text          NOT NULL,
        \`refreshToken\` text          NULL,
        \`tokenExpiry\`  datetime      NULL,
        \`updatedAt\`    datetime(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                                ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_google_tokens_userId\` (\`userId\`),
        CONSTRAINT \`FK_google_tokens_userId\`
          FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`google_tokens\``);
  }
}
