# Sala dalla foto

La sala iniziale di `pecs23.html` è una foto (`sala.png`, 600×337) proiettata su
una stanza ricostruita sulla sua prospettiva. Pavimento, pareti, soffitto e le 14
vetrine hanno le loro misure: quando la camera avanza le cose vicine scorrono più
in fretta di quelle lontane, come in una stanza vera. Sulla parete di fondo le tele
restano in 3D, con la lampada e le ombre vere.

Le immagini sono già dentro la pagina (oggetto `FOTO_SALA`). Questi script
servono solo per rifarle, per esempio con un'altra foto.

## Modelli (tutti open source, pesi scaricabili da GitHub)

| Passaggio | Modello | Pesi |
| --- | --- | --- |
| Ingrandimento 4× | SwinIR-L, real-world GAN | `JingyunLiang/SwinIR` release `v0.0`, `003_realSR_BSRGAN_DFOWMFC_s64w8_SwinIR-L_x4_GAN.pth` |
| Controllo profondità | MiDaS DPT-BEiT-L 512 | `isl-org/MiDaS` release `v3_1`, `dpt_beit_large_512.pt` |
| Foto senza vetrine | LaMa (big-lama) | `enesmsahin/simple-lama-inpainting` release `v0.1.0`, `big-lama.pt` |

Dipendenze: `torch`, `spandrel`, `opencv-python-headless`, `pillow`, `numpy`
(e `timm==0.6.13` più il repository MiDaS solo per `profondita.py`).
Gli script si lanciano da una cartella con dentro `models/` (i pesi) e `up/`
(i file di lavoro, con `up/src.png` = la foto).

## Passaggi

1. **Ingrandimento**: `python ingrandisci.py models/<swinir>.pth up/src.png up/swinir.png 128`
2. **Geometria** (`sala.py`): focale 445 px dalle diagonali delle piastrelle a
   45°, punto di fuga (299.3, 188.1) dalle strisce di luce, profondità della
   parete di fondo dall'attacco col pavimento (y = 206.2), altezza della camera
   fissata a 1,6 m. Le vetrine sono misurate sull'attacco a terra dei
   piedistalli. `profondita.py` (MiDaS) è servito a confermare la distanza
   delle pareti laterali.
3. **Mappa delle vetrine**: `python mappa_vetrine.py` scrive `up/ids.png`
   (quale vetrina si vede in ogni punto della foto) e `up/ids4.npy`.
4. **Foto senza vetrine**: `python pulisci.py` scrive `up/clean.png`.
5. **Fondo più definito**: `python applique.py` toglie l'applique della parete
   di fondo (`up/clean2.png`); da lì si ritagliano il corridoio lontano
   (px 170–430 × 70–265 della foto) e la parete di fondo (240–360 × 120–215) e si
   ingrandiscono ancora 4× con `ingrandisci.py`.
6. **Dentro la pagina**: `python incorpora.py <cartella> ../../pecs23.html`,
   con `foto.png`, `pulita.png`, `medio-4x.png`, `fondo.png`, `ids.png`.

Se si spostano le vetrine in `sala.py` vanno aggiornate anche `VETRINE`, `CAM`
e `ROOM` nello script della sala in `pecs23.html`: l'ordine delle vetrine deve
essere lo stesso della mappa.
