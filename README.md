# Torneios de Dardos

Aplicação web para gerir torneios de dardos: jogadores, ligas com jornadas, e árvores de eliminação simples ou dupla que avançam sozinhas quando se introduzem os resultados.

- **Público** vê as árvores, jogos e classificações ao vivo, sem conta.
- **Organizadores** entram com email e palavra-passe e editam tudo.
- Qualquer número de jogadores: a chave ajusta-se (16, 32, 64…) e os byes são atribuídos automaticamente às primeiras cabeças de série.
- Resultados em legs; a final pode ter um número de legs diferente.
- Corrigir um resultado antigo reajusta a árvore e avisa quais os jogos seguintes que ficam anulados.
- Eliminação dupla com grande final e jogo de desempate "se necessário".

Tecnologia: Next.js (Vercel) + Supabase (base de dados, login e tempo real). Os planos gratuitos de ambos chegam bem.

---

## Publicar (cerca de 15 minutos)

### 1. Supabase (base de dados)
1. Crie conta em https://supabase.com e um projeto novo (região: Europe West).
2. Em **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique **Run**.
3. Em **Authentication → Users → Add user → Create new user**, crie o seu utilizador (email + palavra-passe, com "Auto Confirm User" ligado).
4. Volte ao **SQL Editor** e torne-se organizador (troque o email):
   ```sql
   insert into admins (user_id)
   select id from auth.users where email = 'o-seu@email.pt';
   ```
   Repita para outros organizadores.
5. Recomendado: em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**, para ninguém criar contas sozinho.
6. Em **Project Settings → API** copie o **Project URL** e a chave **anon / publishable**.

### 2. GitHub
Crie um repositório novo e envie esta pasta:
```bash
git init
git add .
git commit -m "Torneios de dardos"
git branch -M main
git remote add origin https://github.com/SEU-UTILIZADOR/torneios-dardos.git
git push -u origin main
```
(Em alternativa: no GitHub, "uploading an existing file" e arraste o conteúdo da pasta.)

### 3. Vercel
1. Em https://vercel.com → **Add New → Project**, importe o repositório.
2. Em **Environment Variables** adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = o Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a chave anon / publishable
3. **Deploy**. Cada `git push` passa a publicar automaticamente.

---

## Correr no computador
```bash
cp .env.example .env.local   # e preencha os dois valores
npm install
npm run dev                  # http://localhost:3000
npm test                     # simula milhares de torneios para validar o motor da árvore
```

## Como funciona
- `lib/bracket.ts` é o motor: gera a estrutura da chave, coloca byes, avança vencedores e perdedores e calcula os lugares finais. O estado é sempre recalculado a partir da ordem do sorteio + resultados, por isso nada fica "desencontrado".
- Lugares na eliminação dupla: 1.º, 2.º, 3.º, 4.º, 5.º–6.º, 7.º–8.º, 9.º–12.º, 13.º–16.º… conforme a ronda em que cada um é eliminado no quadro de perdedores.
- Pontos de liga configuráveis por liga, no formato `1=25; 2=18; 3=15; …` (cada regra vale a partir desse lugar).
