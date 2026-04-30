import fastf1
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import os
import pandas as pd

# Configuração do Cache de Telemetria
CACHE_DIR = './f1_cache'
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)
fastf1.Cache.enable_cache(CACHE_DIR)

class F1Service:
    def __init__(self):
        self.ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        # Timeout definido para não travar o front se a IA local demorar a responder
        self.llm = ChatOllama(model="llama3", base_url=self.ollama_url, temperature=0.3, request_timeout=30.0)

    def get_current_drivers(self, year=2026):
        base_car_url = "https://media.formula1.com/d_team_car_fallback_image.png/content/dam/fom-website/teams/2024/"
        cars = {
            "McLaren": f"{base_car_url}mclaren.png.transform/4col/image.png",
            "Mercedes": f"{base_car_url}mercedes.png.transform/4col/image.png",
            "Red Bull": f"{base_car_url}red-bull-racing.png.transform/4col/image.png",
            "Ferrari": f"{base_car_url}ferrari.png.transform/4col/image.png",
            "Williams": f"{base_car_url}williams.png.transform/4col/image.png",
            "Racing Bulls": f"{base_car_url}rb.png.transform/4col/image.png",
            "Aston Martin": f"{base_car_url}aston-martin.png.transform/4col/image.png",
            "Haas": f"{base_car_url}haas-f1-team.png.transform/4col/image.png",
            "Alpine": f"{base_car_url}alpine.png.transform/4col/image.png",
            "Audi": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Audi_Sport_Logo.png/640px-Audi_Sport_Logo.png",
            "Cadillac": "https://upload.wikimedia.org/wikipedia/commons/a/ae/Cadillac_logo_2009.png"
        }
        raw_drivers = [
            ("NOR", "Lando Norris", "McLaren", 1), ("PIA", "Oscar Piastri", "McLaren", 81),
            ("RUS", "George Russell", "Mercedes", 63), ("ANT", "Kimi Antonelli", "Mercedes", 12),
            ("VER", "Max Verstappen", "Red Bull", 3), ("HAD", "Isack Hadjar", "Red Bull", 6),
            ("LEC", "Charles Leclerc", "Ferrari", 16), ("HAM", "Lewis Hamilton", "Ferrari", 44),
            ("ALB", "Alex Albon", "Williams", 23), ("SAI", "Carlos Sainz", "Williams", 55),
            ("LIN", "Arvid Lindblad", "Racing Bulls", 41), ("LAW", "Liam Lawson", "Racing Bulls", 30),
            ("STR", "Lance Stroll", "Aston Martin", 18), ("ALO", "Fernando Alonso", "Aston Martin", 14),
            ("OCO", "Esteban Ocon", "Haas", 31), ("BEA", "Oliver Bearman", "Haas", 87),
            ("HUL", "Nico Hülkenberg", "Audi", 27), ("BOR", "Gabriel Bortoleto", "Audi", 5),
            ("GAS", "Pierre Gasly", "Alpine", 10), ("COL", "Franco Colapinto", "Alpine", 43),
            ("PER", "Sergio Pérez", "Cadillac", 11), ("BOT", "Valtteri Bottas", "Cadillac", 77)
        ]
        driver_list = []
        for code, name, team, number in raw_drivers:
            driver_list.append({
                "code": code, "name": name, "team": team, "number": number,
                "image": f"assets/drivers/{code}.png", "car": cars.get(team, "")
            })
        return driver_list

    def get_season_history(self, driver_code):
        history_db = {
            "VER": [1, 1, 1, 1, 1, 2, 1, 6, 1, 5, 2, 5, 4, 2, 6, 5, 2, 3, 1, 6, 1, 1],
            "NOR": [6, 8, 3, 5, 2, 1, 2, 2, 2, 20, 3, 2, 3, 1, 1, 4, 1, 4, 2, 3, 6, 2],
            "LEC": [4, 3, 2, 4, 4, 3, 1, 3, 5, 4, 1, 3, 1, 3, 2, 1, 3, 5, 1, 2, 3, 3],
        }
        positions = history_db.get(driver_code, [10, 12, 11, 14, 10, 15, 12, 11, 10, 13, 12, 11, 14, 15, 12, 11, 10, 12, 11, 14])
        races = ["BHR", "SAU", "AUS", "JPN", "CHN", "MIA", "EMI", "MON", "CAN", "ESP", "AUT", "GBR", "HUN", "BEL", "NED", "ITA", "AZE", "SIN", "USA", "MEX", "BRA", "LVG"]
        return {"type": "season_history", "labels": races[:len(positions)], "data": positions}

    def get_session_data(self, year, race, driver_code):
        try:
            # Carrega a sessão oficial da corrida com telemetria ativa
            session = fastf1.get_session(year, race, 'R')
            session.load(telemetry=True, laps=True, weather=False)
            laps = session.laps.pick_driver(driver_code)
            
            if laps.empty: return None
            
            # Posição final e de largada
            pos_finish = int(laps['Position'].iloc[-1]) if not pd.isna(laps['Position'].iloc[-1]) else "DNF"
            try: 
                grid_pos = int(session.results.loc[session.results['Abbreviation'] == driver_code].iloc[0]['GridPosition'])
            except: 
                grid_pos = "Box"
            
            # Limpeza de dados para obter voltas reais de corrida (sem Safety Car, In/Out laps)
            clean_laps = laps.pick_quicklaps().dropna(subset=['LapTime', 'TyreLife'])
            
            # Extração de Velocidade Máxima (Speed Trap) para análise de downforce
            fastest_lap = laps.pick_fastest()
            top_speed = fastest_lap['SpeedST'] if not pd.isna(fastest_lap['SpeedST']) else 0
            
            return {
                "name": race, 
                "grid": grid_pos, 
                "finish": pos_finish, 
                "top_speed_kph": float(top_speed),
                "stints": laps['Compound'].dropna().unique().tolist(),
                "metrics": {
                    "laps": clean_laps['LapNumber'].tolist(),
                    "times": clean_laps['LapTime'].dt.total_seconds().tolist(),
                    "tyre_life": clean_laps['TyreLife'].tolist(), # Idade do pneu em voltas
                    "compounds": clean_laps['Compound'].tolist(),
                    "s1_times": clean_laps['Sector1Time'].dt.total_seconds().fillna(0).tolist(),
                    "s2_times": clean_laps['Sector2Time'].dt.total_seconds().fillna(0).tolist(),
                    "s3_times": clean_laps['Sector3Time'].dt.total_seconds().fillna(0).tolist()
                }
            }
        except Exception as e:
            print(f"[Telemetry Error] Falha ao extrair dados de {driver_code} em {race}: {e}")
            return None

    def analyze_driver_evolution(self, driver_code: str, race_x: str, race_y: str, year=2025):
        # 1. Obter Dados e Montar Contexto Analítico
        chart_data = None
        mode = "season"
        context = ""

        if race_x == 'SEASON' or not race_x:
            season_data = self.get_season_history(driver_code)
            chart_data = season_data
            mode = "season"
            positions = [p for p in season_data['data'] if isinstance(p, int)]
            avg_pos = round(sum(positions)/len(positions), 1) if positions else 0
            context = f"Resumo F1 {year}. Piloto: {driver_code}. Média Chegada: P{avg_pos}. Resultados: {positions}."
        else:
            data_x = self.get_session_data(year, race_x, driver_code)
            data_y = self.get_session_data(year, race_y, driver_code)
            
            if not data_x or not data_y:
                return {"analysis": "Dados de telemetria indisponíveis para processamento.", "chart_data": None}
            
            chart_data = { "race_x": data_x, "race_y": data_y }
            mode = "compare"
            
            # Cálculo de ritmo médio para simplificar o payload para o Llama3
            avg_pace_x = round(sum(data_x["metrics"]["times"]) / len(data_x["metrics"]["times"]), 3)
            avg_pace_y = round(sum(data_y["metrics"]["times"]) / len(data_y["metrics"]["times"]), 3)
            
            context = (
                f"Comparativo Técnico - Piloto: {driver_code}\n"
                f"- Corrida A ({data_x['name']}): Largou P{data_x['grid']}, Chegou P{data_x['finish']}. "
                f"Top Speed: {data_x['top_speed_kph']}km/h. Estratégia: {data_x['stints']}. Pace Médio Limpo: {avg_pace_x}s.\n"
                f"- Corrida B ({data_y['name']}): Largou P{data_y['grid']}, Chegou P{data_y['finish']}. "
                f"Top Speed: {data_y['top_speed_kph']}km/h. Estratégia: {data_y['stints']}. Pace Médio Limpo: {avg_pace_y}s."
            )

        # 2. Processamento via LLM (Blindado para tolerância a falhas)
        try:
            prompt = ChatPromptTemplate.from_template(
                """Você é o Engenheiro Chefe de Estratégia e Dados da Fórmula 1. Responda em Português.
                Analise a evolução de setup e performance mecânica entre estas corridas.
                Foque nas correlações: Eficiência de Top Speed vs Ritmo de corrida, e estratégia de pneus.
                DADOS DE TELEMETRIA: {context}"""
            )
            chain = prompt | self.llm | StrOutputParser()
            analysis_text = chain.invoke({"context": context})
        except Exception as e:
            print(f"[Inference Error] Falha de comunicação com o modelo local (Ollama): {e}")
            analysis_text = f"⚠️ O pipeline de IA está offline no momento. Exibindo dados de telemetria brutos para o piloto {driver_code}."

        return {
            "analysis": analysis_text,
            "chart_data": chart_data,
            "mode": mode
        }

    def get_team_stats(self, team_name: str):
        return {"team": team_name, "wins": 0, "news": []}