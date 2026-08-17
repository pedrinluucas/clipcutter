# ClipCutter — como instalar

Mande **um arquivo só**: `clipcutter-1.0.0-setup.exe` (134 MB).

Ele é autossuficiente — leva o app e o FFmpeg dentro. Quem receber não precisa
instalar mais nada.

---

## Texto para enviar junto

Copie daqui para baixo:

> **ClipCutter — instalador (134 MB)**
>
> O Windows vai avisar que não conhece o publicador. É esperado: o app é interno
> e não tem certificado comercial. Não é vírus.
>
> **Se aparecer a tela azul "O Windows protegeu o seu computador":**
> clique em **Mais informações** e depois em **Executar assim mesmo**.
>
> Ele instala sozinho e cria o atalho na área de trabalho. Não precisa instalar
> mais nada — o FFmpeg já vem junto.
>
> **Como usar:** arraste um vídeo para a janela, escolha a duração de cada parte
> (os botões 29,9s e 59,9s já vêm com a margem que as redes sociais exigem),
> clique em **Gerar cortes**, escolha a pasta e clique em **Exportar**.

---

## Se der "Smart App Control blocked an app"

Aviso diferente, mais rígido — **não tem botão de "executar assim mesmo"**.

Ele bloqueia programas **sem reputação**, não sem assinatura: qualquer executável
recém-criado, que ainda não existe em outras máquinas do mundo, é barrado.

Costuma estar ligado só em instalação limpa de Windows 11. Para desligar:

**Configurações → Privacidade e segurança → Segurança do Windows → Controle de
aplicativos e navegador → Smart App Control → Desativado**

⚠️ **Numa máquina de trabalho, pense antes:** uma vez desligado, só volta a ligar
reinstalando o Windows. Numa máquina virtual ou de testes, sem problema.

---

## Por que esses avisos existem

Assinar um app custa entre US$200 e US$600 por ano em certificado. Enquanto o
ClipCutter for ferramenta interna, não compensa — e o preço disso é o aviso.

Se um dia for distribuído de verdade, assinar resolve os dois casos de uma vez.

---

## Para quem já tem o projeto na máquina

Não precisa do instalador. Na pasta do projeto:

```
npm install
npm run build
```

Depois é só usar o atalho criado por `scripts/abrir-clipcutter.vbs`, que abre o
app compilado sem passar pelo instalador — e sem esbarrar no Smart App Control,
porque quem executa é o `electron.exe` original.
