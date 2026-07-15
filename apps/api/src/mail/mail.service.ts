import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {


constructor(
 private mailer:MailerService
){}



/*async sendVerificationEmail(email:string){


await this.mailer.sendMail({

 to:email,

 subject:'Email megerősítés',

 html:`
 <h2>Sikeresen regisztráltál a Kajai oldalra!</h2>
 <p>Kattints a regisztráció megerősítéshez:</p>
 <a href="https://app.hu/verify">
 https://app.hu/verify linkre
 </a>
 `

});


}*/

async sendVerificationEmail(email: string) {
  console.log(`Verification email would be sent to: ${email}`);
  return true;
}

}
