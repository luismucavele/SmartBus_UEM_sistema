# Direcção de design — SmartATM Maputo

## Três abordagens possíveis

### 1. Atlas Cívico
**Very Brief Intro:** Uma aplicação de mobilidade urbana com a clareza de um mapa editorial impresso: base em marfim, tipografia séria, linhas de rota expressivas e um azul profundo que transmite confiança. O objectivo é tornar uma decisão urgente simples e verificável.

**Probability:** 0.06

### 2. Sinal de Rede
**Very Brief Intro:** Uma interface escura e técnica, inspirada em centros de operação, com estados luminosos e indicadores de telemetria. A estética valoriza urgência, disponibilidade e leitura de dados em tempo real.

**Probability:** 0.04

### 3. Mercado de Rua
**Very Brief Intro:** Uma experiência calorosa, com referências a placas de rua, texturas tácteis e cores solares de Maputo. O ambiente prioriza proximidade comunitária e linguagem simples.

**Probability:** 0.08

## Abordagem escolhida: Atlas Cívico

### Design Movement
Editorial cartography e sinalética urbana contemporânea.

### Core Principles
1. A informação de decisão deve aparecer antes da decoração: banco, estado, distância e confiança são sempre legíveis num relance.
2. O mapa é o centro funcional da composição; as listas e os cartões comportam-se como uma legenda cartográfica viva.
3. O sistema comunica incerteza de modo honesto, com a hora da última confirmação e uma pontuação de confiança.
4. O contraste entre marfim claro, azul de tinta e laranja de alerta torna os estados operacionais claros sem criar uma estética bancária genérica.

### Color Philosophy
O fundo em marfim quente reduz a tensão de uma necessidade urgente. O azul-petróleo representa confiança e orientação; o verde confirma operação; o coral-laranja concentra a atenção em falhas e alertas. As linhas de mapa em azul suave transformam a informação geográfica num elemento de marca.

### Layout Paradigm
Uma consola cartográfica assimétrica: uma coluna lateral de orientação e filtros, um território de mapa dominante e uma faixa lateral de recomendações que se sobrepõe ao mapa em ecrãs amplos. Não se trata de um dashboard de grelha uniforme; é uma estação de decisão espacial.

### Signature Elements
1. Linhas de rota pontilhadas e arcos subtis na área do mapa.
2. Marcadores de ATM em formato de pino quadrado, com um pequeno “pulso” para o ATM recomendado.
3. Etiquetas em caixa alta com espaçamento amplo, semelhantes a sinalética urbana.

### Interaction Philosophy
Cada clique deve diminuir a incerteza: seleccionar banco, estado ou distância actualiza o mapa e a recomendação sem recarregar a página. Relatar uma falha é tratado como uma contribuição comunitária, com confirmação clara e reversível.

### Animation
Entradas discretas em cascata, entre 30 e 70 ms, para filtros, cartões e marcadores. O marcador recomendado recebe um pulso de opacidade subtil. As transições de filtro usam apenas opacidade e transformação, com duração máxima de 220 ms e respeito por `prefers-reduced-motion`.

### Typography System
**DM Serif Display** é usada em títulos de decisão e recomendações importantes; **Manrope** suporta todo o texto de interface, números e metadados. Títulos são compactos, com peso 600–700; etiquetas são em caixa alta, 11–12 px e espaçamento amplo.

### Brand Essence
**Uma bússola urbana para encontrar o ATM certo antes de sair de casa.** Personalidade: confiável, clara e atenta.

### Brand Voice
Os títulos são directos e calmos; os CTAs descrevem a acção precisa; as mensagens de estado explicam a confiança da informação.

Exemplos: “Encontre um ATM que vale a caminhada.” e “Dados confirmados há 6 minutos.”

### Wordmark & Logo
Uma marca geométrica sem texto: um quadrado de ATM aberto por uma seta de navegação, com um ponto circular no centro para representar localização. O símbolo deve funcionar isoladamente como favicon.

### Signature Brand Color
**Azul Índico — #0A5477**.

## Style Decisions

- O mapa deve manter sempre linhas de rua e costa, caminhos pontilhados, pinos quadrados e um pulso de recomendação, mesmo quando os dados do mapa não estiverem disponíveis.
- Filtros, cartões e listas funcionam como uma legenda cartográfica: metadados compactos, divisores de tinta, etiquetas em caixa alta e cores reservadas exclusivamente aos estados operacionais.
- A geometria recorrente da marca é um quadrado de ATM aberto por uma indicação de direcção e um ponto central; o mesmo vocabulário visual informa pinos, monogramas bancários e indicadores de estado.
