"""POC-02 Failure Scenario Engine.

Defines the four controlled degradation scenarios from the requirements
(section 6) and the severity curve used to ramp a scenario in gradually
over its injection window, as opposed to a sudden step change.
"""

from dataclasses import dataclass, field

SEVERITY_INTENSITY = {
    "LOW": 0.4,
    "MEDIUM": 0.7,
    "HIGH": 1.0,
}


@dataclass(frozen=True)
class ScenarioDefinition:
    key: str
    label: str
    likely_issue: str
    signals: list[str]
    suggested_checks: list[str]


SCENARIOS: dict[str, ScenarioDefinition] = {
    "cooling_degradation": ScenarioDefinition(
        key="cooling_degradation",
        label="Cooling Degradation",
        likely_issue="Cooling subsystem degradation",
        signals=[
            "Temperature increasing",
            "Temperature variance increasing",
            "Charging duration increasing",
            "Current fluctuation increasing",
        ],
        suggested_checks=[
            "Inspect cooling fan",
            "Check thermal sensor",
            "Inspect cooling path",
            "Check charging module",
            "Review recent error codes",
        ],
    ),
    "charging_degradation": ScenarioDefinition(
        key="charging_degradation",
        label="Charging Subsystem Degradation",
        likely_issue="Charging subsystem risk",
        signals=[
            "Current fluctuation increasing",
            "Charging duration increasing",
            "Charging efficiency decreasing",
            "Failed charging events increasing",
        ],
        suggested_checks=[
            "Inspect charging module",
            "Check power converter",
            "Test charging contacts",
            "Review failed swap logs",
            "Check current sensor calibration",
        ],
    ),
    "connectivity_degradation": ScenarioDefinition(
        key="connectivity_degradation",
        label="Connectivity Degradation",
        likely_issue="Connectivity risk",
        signals=[
            "Connection drops increasing",
            "Reconnect frequency increasing",
            "Latency increasing",
            "Communication errors increasing",
        ],
        suggested_checks=[
            "Inspect network module",
            "Check SIM/connectivity hardware",
            "Verify signal strength at site",
            "Restart communication gateway",
            "Review communication error logs",
        ],
    ),
    "station_performance_degradation": ScenarioDefinition(
        key="station_performance_degradation",
        label="Station Performance Degradation",
        likely_issue="Station performance degradation",
        signals=[
            "Swap success decreasing",
            "Charging duration increasing",
            "Error events increasing",
            "Station throughput decreasing",
        ],
        suggested_checks=[
            "Inspect swap mechanism",
            "Check battery bay alignment",
            "Review station error logs",
            "Inspect station firmware version",
            "Check station power supply",
        ],
    ),
}


@dataclass(frozen=True)
class ScenarioInjectionSpec:
    scenario_key: str
    severity: str
    duration_days: int
    asset_id: str | None = None
    metadata: dict = field(default_factory=dict)

    @property
    def intensity(self) -> float:
        return SEVERITY_INTENSITY.get(self.severity.upper(), 0.7)

    @property
    def definition(self) -> ScenarioDefinition:
        return SCENARIOS[self.scenario_key]


def ramp_fraction(hours_into_window: float, total_window_hours: float) -> float:
    """Gradual (linear) ramp from 0 -> 1 across the injection window.

    Deterioration must happen gradually rather than suddenly, per spec
    section 5.3 — early detection depends on catching the trend before it
    becomes a hard failure.
    """
    if total_window_hours <= 0:
        return 1.0
    fraction = hours_into_window / total_window_hours
    return max(0.0, min(1.0, fraction))
