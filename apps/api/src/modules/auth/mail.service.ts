import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: AppConfigService) {}

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    if (this.config.emailProvider === 'none') {
      this.logger.log(`Password reset link for ${email}: ${resetUrl}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: false,
    });

    await transporter.sendMail({
      from: this.config.emailFrom,
      to: email,
      subject: 'Réinitialisation du mot de passe — Gym Companion',
      text: `Réinitialisez votre mot de passe : ${resetUrl}`,
      html: `<p>Réinitialisez votre mot de passe :</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }
}
