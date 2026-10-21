# Money Penny

Sijoituskierroksen seurantatyökalu, joka toimii selaimessa ja asennettavana sovelluksena (PWA) tietokoneella ja puhelimessa. Data tallentuu Supabaseen, joten koko tiimi näkee samat tiedot reaaliajassa.

## Tiedostot

| Tiedosto | Tarkoitus |
|---|---|
| `index.html` | Itse sovellus |
| `config.js` | Supabase-osoite ja -avain (täytä nämä) |
| `supabase-adapter.js` | Kirjautuminen ja tietokantayhteys |
| `manifest.json`, `sw.js`, `icons/` | Tekevät sivusta asennettavan sovelluksen |
| `supabase/schema.sql` | Tietokannan rakenne ja käyttöoikeudet |

## 1. Supabase (n. 10 min)

1. Luo tili ja uusi projekti osoitteessa supabase.com. Valitse alueeksi esim. *North EU (Stockholm)*.
2. Avaa **SQL Editor → New query**, liitä `supabase/schema.sql` ja paina **Run**.
3. Lisää käyttäjät samassa editorissa (vaihda osoitteet):
   ```sql
   insert into public.mp_members (email) values ('sinä@yritys.fi'), ('kollega@yritys.fi');
   ```
4. Siirrä nykyinen data: liitä erillinen `money-penny-data-import.sql` uuteen kyselyyn ja paina **Run**. **Älä laita tätä tiedostoa GitHubiin.**
5. **Luo käyttäjätunnukset:** Authentication → Users → **Add user** → **Create new user**. Kirjoita sähköposti ja salasana, rastita **Auto Confirm User** ja klikkaa **Create user**. Tee sama jokaiselle tiimin jäsenelle. Samojen osoitteiden pitää olla myös `mp_members`-taulussa.
6. **Project Settings → API Keys**: kopioi *Publishable key* (tai Legacy-välilehden *anon public*) ja **Project Settings → Data API**: kopioi *Project URL*. Liitä molemmat tiedostoon `config.js`.

## 2. GitHub Pages (n. 5 min)

1. Luo GitHubissa uusi repository, esim. `money-penny`.
2. Valitse **Add file → Upload files** ja raahaa tämän kansion sisältö sinne (myös `icons`- ja `supabase`-kansiot). Paina **Commit changes**.
3. **Settings → Pages**: Source = *Deploy from a branch*, Branch = `main` / `(root)` → **Save**.
4. Minuutin päästä sivu on osoitteessa `https://<käyttäjänimi>.github.io/money-penny/`.
5. Palaa Supabaseen: **Authentication → URL Configuration** → aseta *Site URL* ja lisää *Redirect URLs* -listaan tuo sama osoite.

Ilmainen GitHub Pages vaatii julkisen repositoryn. Se on tässä turvallista: koodissa ei ole salaisuuksia, ja anon-avain on tarkoitettu julkiseksi. Data on suojattu tietokannassa, ja vain `mp_members`-listalla olevat pääsevät siihen käsiksi.

## 3. Asennus laitteille

- **Tietokone (Chrome tai Edge):** avaa sivu ja klikkaa osoiterivin asennuskuvaketta.
- **Android (Chrome):** valikko ⋮ → *Asenna sovellus*.
- **iPhone (Safari):** Jaa-painike → *Lisää Koti-valikkoon*.

Kirjautuminen tapahtuu sähköpostilla ja salasanalla, jotka loit Supabasessa.

## Ylläpito

- **Uusi käyttäjä:** luo tunnus (Authentication → Users → Add user) ja lisää sama sähköposti `mp_members`-tauluun.
- **Salasanan vaihto:** Authentication → Users → klikkaa käyttäjää → aseta uusi salasana.
- **Päivitykset:** lataa muuttunut tiedosto GitHubiin. Sovellukset hakevat uuden version seuraavalla avauskerralla.
- **Varmuuskopio:** Supabasen Table Editorissa `mp_docs` → *Export to CSV*.
- Supabasen ilmaisversio keskeyttää projektin, jos sitä ei käytetä viikkoon. Sen saa käynnistettyä uudelleen Supabasen hallintapaneelista.

## Mikä muuttui Claude-versioon verrattuna

- Google Calendar -kutsujen luonti toimi Clauden yhteyksien kautta, eikä se ole käytössä tässä versiossa. Tapaamiset tallentuvat normaalisti.
- Raportin vienti lataa HTML-tiedoston suoraan selaimeen.
- Jos `config.js` on tyhjä, sovellus tallentaa tiedot vain kyseiseen selaimeen.
