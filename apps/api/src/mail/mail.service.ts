import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {


constructor(
 private mailer:MailerService
){

}



async sendVerificationEmail(email:string,mailToken:string){
const location= `${process.env.NEXTAUTH_URL ?? "app.hu"}/verify?id=`;

await this.mailer.sendMail({
  from:"noreply@kajai.hu",
  to:email,

  subject:'Email megerősítés',

  html:`
  <h2>Sikeresen regisztráltál a Kajai oldalra!</h2>
  <p>Kattints a regisztráció megerősítéshez:</p>
  <p><a href="${location}${mailToken}">
  ${location}${mailToken} linkre
  </a></p>
  Üdvözlettel<br>
  KajAi
  `
  });
}

async sendNewPasswordEmail(email:string,mailToken:string){
  const location= `${process.env.NEXTAUTH_URL ?? "app.hu"}/reset_password?id=`;
  await this.mailer.sendMail({
  from:"noreply@kajai.hu",
  to:email,

  subject:'Új jelszó kérése',

  html:`
  <h2>új jelszó kérése!</h2>
  <p>ezt a levelet azért kapja mert új jelszót igényelt Kajai felületre. Hanem ön kérte az új jelszót nincs teendője.</p>
  <p>ha viszont új jelszót szeretne kérem kattintson az alábbi linkre 1 órán belül: </p>
  <p><a href="${location}${mailToken}">
  ${location}${mailToken} linkre
  </a></p>
  Üdvözlettel<br>
  KajAi
  `
  });
}

async sendChangePasswordEmail(email: string, mailToken: string ) {
  const location = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/change_password?token=`
  await this.mailer.sendMail({
    from: 'noreply@kajai.hu',
    to: email,

    subject: 'Jelszó módosítása',

    html: `
      <h2>Jelszó módosítása</h2>

      <p>
        Jelszó módosítását kezdeményezted a KajAi felületén.
      </p>

      <p>
        A jelszó módosításához kattints az alábbi linkre:
      </p>

      <p>
        <a href="${location}${mailToken}">
          Jelszó módosítása
        </a>
      </p>

      <p>
        A link 1 órán keresztül érvényes.
      </p>

      <p>
        Ha nem te kezdeményezted ezt a műveletet,
        nincs további teendőd.
      </p>

      <p>
        Üdvözlettel<br>
        KajAi
      </p>
    `,
  })
}

/*async sendVerificationEmail(email: string) {
  console.log(`Verification email would be sent to: ${email}`);
  return true;
}*/


}
