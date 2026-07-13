# 👑 King Alfa — Programa de Níveis v2
## Guia de instalação completo

---

## O que você vai precisar
- Conta GitHub (gratuita) — github.com
- Conta Vercel (gratuita) — vercel.com
- Conta JSONBin (gratuita) — jsonbin.io
- 30 minutos

---

## PASSO 1 — Criar o Bin no JSONBin

1. Acesse **jsonbin.io** e faça login
2. Vá em **Bins → Create a Bin**
3. Cole o JSON abaixo e clique em **Create**:

```json
{
  "adminPin": "03ac674216f3e15c761ee1a5e255f067953623c8d0032d6cbac8dfa0a50ee5a4",
  "config": {
    "niveis": [
      {"id":0,"nome":"Escudeiro","minAp":0,"maxAp":20,"pct":0.008},
      {"id":1,"nome":"Cavaleiro","minAp":21,"maxAp":30,"pct":0.0115},
      {"id":2,"nome":"Duque","minAp":31,"maxAp":40,"pct":0.018},
      {"id":3,"nome":"Rei","minAp":41,"maxAp":9999,"pct":0.02}
    ]
  },
  "unidades": [
    {"id":1,"nome":"King 1 — Matriz","nomeGC":"KING 01 - Matriz","lojaId":"","metaServicos":null},
    {"id":2,"nome":"King 02 — Pq. Anhanguera","nomeGC":"KING 02 - Pq. Anhanguera","lojaId":"","metaServicos":null},
    {"id":3,"nome":"King 03 — Igualdade","nomeGC":"KING 03 - Igualdade","lojaId":"","metaServicos":null}
  ],
  "vendedores": [
    {"id":1,"nome":"King Garavelo","nomesGC":["King Garavelo"],"unidadeId":1,"isSocio":true,"salario":0,"beneficios":0,"pin":"03ac674216f3e15c761ee1a5e255f067953623c8d0032d6cbac8dfa0a50ee5a4","pinInicial":true,"metaServicos":null,"nivelAtual":1,"mesesAcima":0,"mesesAbaixo":0},
    {"id":2,"nome":"Jamilly","nomesGC":["Jamilly"],"unidadeId":1,"isSocio":false,"salario":1722,"beneficios":200,"pin":"03ac674216f3e15c761ee1a5e255f067953623c8d0032d6cbac8dfa0a50ee5a4","pinInicial":true,"metaServicos":null,"nivelAtual":1,"mesesAcima":0,"mesesAbaixo":0},
    {"id":3,"nome":"Gabrielly","nomesGC":["Gabrielly"],"unidadeId":1,"isSocio":false,"salario":1722,"beneficios":200,"pin":"03ac674216f3e15c761ee1a5e255f067953623c8d0032d6cbac8dfa0a50ee5a4","pinInicial":true,"metaServicos":null,"nivelAtual":1,"mesesAcima":0,"mesesAbaixo":0},
    {"id":4,"nome":"Alexsander Celestino","nomesGC":["Alexsander Celestino"],"unidadeId":1,"isSocio":true,"salario":0,"beneficios":0,"pin":"03ac674216f3e15c761ee1a5e255f067953623c8d0032d6cbac8dfa0a50ee5a4","pinInicial":true,"metaServicos":null,"nivelAtual":1,"mesesAcima":0,"mesesAbaixo":0},
    {"id":5,"nome":"King Garavelo + Anhanguera","nomesGC":["King Garavelo","King Anhanguera"],"unidadeId":2,"isSocio":true,"salario":0,"beneficios":0,"pin":"03ac674216f3e15c761ee1a5e255f067953623c8d0032d6cbac8dfa0a50ee5a4","pinInicial":true,"metaServicos":null,"nivelAtual":1,"mesesAcima":0,"mesesAbaixo":0},
    {"id":6,"nome":"Geovana","nomesGC":["Geovana"],"unidadeId":2,"isSocio":false,"salario":1722,"beneficios":200,"pin":"03ac674216f3e15c761ee1a5e255f067953623c8d0032d6cbac8dfa0a50ee5a4","pinInicial":true,"metaServicos":null,"nivelAtual":1,"mesesAcima":0,"mesesAbaixo":0},
    {"id":7,"nome":"Karen Tayene","nomesGC":["Karen Tayene"],"unidadeId":2,"isSocio":true,"salario":0,"beneficios":0,"pin":"03ac674216f3e15c761ee1a5e255f067953623c8d0032d6cbac8dfa0a50ee5a4","pinInicial":true,"metaServicos":null,"nivelAtual":1,"mesesAcima":0,"mesesAbaixo":0},
    {"id":8,"nome":"King Alfa 3 Igualdade","nomesGC":["King Alfa 3 Igualdade"],"unidadeId":3,"isSocio":true,"salario":0,"beneficios":0,"pin":"03ac674216f3e15c761ee1a5e255f067953623c8d0032d6cbac8dfa0a50ee5a4","pinInicial":true,"metaServicos":null,"nivelAtual":1,"mesesAcima":0,"mesesAbaixo":0},
    {"id":9,"nome":"Camila Lima","nomesGC":["Camila Lima"],"unidadeId":3,"isSocio":false,"salario":1722,"beneficios":200,"pin":"03ac674216f3e15c761ee1a5e255f067953623c8d0032d6cbac8dfa0a50ee5a4","pinInicial":true,"metaServicos":null,"nivelAtual":1,"mesesAcima":0,"mesesAbaixo":0},
    {"id":10,"nome":"Ana Clara","nomesGC":["Ana Clara"],"unidadeId":3,"isSocio":false,"salario":1722,"beneficios":200,"pin":"03ac674216f3e15c761ee1a5e255f067953623c8d0032d6cbac8dfa0a50ee5a4","pinInicial":true,"metaServicos":null,"nivelAtual":1,"mesesAcima":0,"mesesAbaixo":0},
    {"id":11,"nome":"Izadora Alves","nomesGC":["Izadora Alves"],"unidadeId":3,"isSocio":false,"salario":1722,"beneficios":200,"pin":"03ac674216f3e15c761ee1a5e255f067953623c8d0032d6cbac8dfa0a50ee5a4","pinInicial":true,"metaServicos":null,"nivelAtual":1,"mesesAcima":0,"mesesAbaixo":0}
  ]
}
```

4. Copie o **BIN ID** e a **API Key** (em API Keys no menu)

---

## PASSO 2 — Criar repositório no GitHub

1. Acesse **github.com** e crie uma conta (se não tiver)
2. Clique em **New repository**
3. Nome: `kingalfa-niveis` → **Create repository**
4. Faça upload de todos os arquivos desta pasta (arraste na tela)

---

## PASSO 3 — Publicar no Vercel

1. Acesse **vercel.com** e conecte com sua conta GitHub
2. Clique em **Add New → Project**
3. Selecione o repositório `kingalfa-niveis`
4. Na tela de configuração, clique em **Environment Variables** e adicione:

| Nome | Valor |
|------|-------|
| `GC_ACCESS_TOKEN` | `ce0e3f490d365e7db4cf46fb36588d10d2f3e4db` |
| `GC_SECRET_TOKEN` | `81a438da9da6c931af2bd240585a87781d9016e4` |

5. Clique em **Deploy** — aguarde ~2 minutos
6. Copie o link gerado (ex: `kingalfa-niveis.vercel.app`)

---

## PASSO 4 — Configurar o site

1. Abra o arquivo `index.html` no Bloco de Notas
2. Encontre e substitua:
   ```
   var JSONBIN_ID  = 'COLE_O_BIN_ID_AQUI';
   var JSONBIN_KEY = 'COLE_SUA_API_KEY_AQUI';
   ```
3. Salve e faça upload novamente no GitHub (substitua o arquivo antigo)
4. O Vercel atualiza automaticamente

---

## PASSO 5 — Configurar IDs das lojas no Gestão Click

Para a integração funcionar, você precisa dos IDs numéricos das lojas:

1. No site já no ar, faça login como **Admin**
2. Vá em **Admin → Sincronizar**
3. Se der erro mencionando `loja_id`, você precisa:
   - No Gestão Click, ir em **Configurações → Lojas**
   - Pegar o ID numérico de cada loja
   - No painel Admin do site, atualizar os IDs

---

## Como usar no dia a dia

**Todo mês, ao fechar:**
1. Acesse o site como Admin
2. Vá em **Admin → Sincronizar com Gestão Click**
3. O sistema calcula automaticamente os níveis

**Para ajustar metas de serviços:**
- Admin → Meta de Serviços por Unidade (afeta toda a unidade)
- Admin → Vendedores → coluna "Meta Serv." (individual)

**Para redefinir PIN de vendedor:**
- Admin → Vendedores → botão "1234" ao lado do vendedor

---

## Senhas iniciais

- **Admin:** `1234` (altere em Admin → Alterar PIN do Admin)
- **Todos os vendedores:** `1234` (cada um troca no primeiro acesso)
- <!-- redeploy -->
<!-- redeploy -->
BOBA
