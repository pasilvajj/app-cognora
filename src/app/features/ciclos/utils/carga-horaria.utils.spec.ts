import { calcularHorasPorMateria } from './carga-horaria.utils';
import {
  MIN_HORAS_6_MATERIAS,
  MIN_HORAS_7_OU_MAIS,
  MIN_HORAS_POR_MATERIA,
} from '../constants/estudo-livre.constants';

function materiasComPesos(pesos: number[]) {
  return pesos.map((peso, i) => ({ id: i + 1, checked: true, peso }));
}

function horas(id: number, result: ReturnType<typeof calcularHorasPorMateria>) {
  return result.perMateria.find(m => m.id === id)!;
}

describe('calcularHorasPorMateria', () => {
  it('uma matéria ativa recebe o pool inteiro', () => {
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      materias: [{ id: 1, checked: true, peso: 5 }],
    });

    expect(result.perMateria[0].horas).toBe(26);
    expect(result.perMateria[0].horasLabel).toBe('26:00h');
  });

  it('4 matérias: bate cenário de referência (img 1)', () => {
    const pesos = [30, 18, 7, 6];
    const expected = ['13:00h', '7:30h', '3:00h', '2:30h'];
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      materias: materiasComPesos(pesos),
    });

    expected.forEach((label, i) => {
      expect(horas(i + 1, result).horasLabel).toBe(label);
    });
    expect(result.perMateria.reduce((s, m) => s + m.horas, 0)).toBe(26);
  });

  it('5 matérias: bate cenário de referência (img 2)', () => {
    const pesos = [30, 18, 7, 6, 7];
    const expected = ['11:30h', '7:00h', '2:30h', '2:30h', '2:30h'];
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      materias: materiasComPesos(pesos),
    });

    expected.forEach((label, i) => {
      expect(horas(i + 1, result).horasLabel).toBe(label);
    });
    expect(result.perMateria.every(m => m.horas >= MIN_HORAS_POR_MATERIA)).toBe(true);
  });

  it('6 matérias: piso 2:00h (img 3)', () => {
    const pesos = [30, 18, 7, 6, 7, 5];
    const expected = ['10:30h', '6:30h', '2:30h', '2:00h', '2:30h', '2:00h'];
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      materias: materiasComPesos(pesos),
    });

    expected.forEach((label, i) => {
      expect(horas(i + 1, result).horasLabel).toBe(label);
    });
    expect(result.perMateria.every(m => m.horas >= MIN_HORAS_6_MATERIAS)).toBe(true);
  });

  it('7 matérias: piso 1:30h (img 4)', () => {
    const pesos = [30, 18, 7, 6, 7, 5, 5];
    const expected = ['10:00h', '6:00h', '2:30h', '2:00h', '2:30h', '1:30h', '1:30h'];
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      materias: materiasComPesos(pesos),
    });

    expected.forEach((label, i) => {
      expect(horas(i + 1, result).horasLabel).toBe(label);
    });
    expect(result.perMateria.every(m => m.horas >= MIN_HORAS_7_OU_MAIS)).toBe(true);
  });

  it('8 matérias: Hamilton + piso 1:30h (img 5 — empate no resto)', () => {
    const pesos = [30, 18, 7, 6, 7, 5, 5, 5];
    const expected = ['9:30h', '5:30h', '2:30h', '2:00h', '2:00h', '1:30h', '1:30h', '1:30h'];
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      materias: materiasComPesos(pesos),
    });

    expected.forEach((label, i) => {
      expect(horas(i + 1, result).horasLabel).toBe(label);
    });
    expect(horas(1, result).horas).toBeGreaterThan(horas(6, result).horas);
  });

  it('peso maior nunca fica com menos horas que peso menor', () => {
    const pesos = [30, 7, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 2];
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      materias: materiasComPesos(pesos),
    });

    const ativas = result.perMateria.filter(m => m.horas > 0);
    for (let i = 0; i < pesos.length; i++) {
      for (let j = i + 1; j < pesos.length; j++) {
        if (pesos[i] > pesos[j]) {
          expect(horas(i + 1, result).horas).toBeGreaterThanOrEqual(horas(j + 1, result).horas);
        }
      }
    }
    expect(ativas.reduce((s, m) => s + m.horas, 0)).toBe(26);
  });

  it('carga 19h (8 matérias): peso 30 fica com 30 min a mais que peso 18 quando empatavam em 3:00h', () => {
    const pesos = [30, 18, 8, 7, 7, 6, 6, 5];
    const poolMateriasHoras = 19 - 4;
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: poolMateriasHoras,
      materias: materiasComPesos(pesos),
    });

    const transito = horas(1, result);
    const portugues = horas(2, result);
    expect(transito.horasLabel).toBe('3:30h');
    expect(portugues.horasLabel).toBe('2:30h');
    expect(transito.horas - portugues.horas).toBe(1);
    expect(result.perMateria.reduce((s, m) => s + m.horas, 0)).toBe(poolMateriasHoras);
  });

  it('sinaliza pool insuficiente para o piso dinâmico', () => {
    const pesos = Array.from({ length: 18 }, () => 5);
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      materias: materiasComPesos(pesos),
    });

    expect(result.warningMinimoNaoAtendido).toBe(true);
  });
});
