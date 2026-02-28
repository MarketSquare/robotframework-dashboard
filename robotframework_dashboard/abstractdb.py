from abc import ABC, abstractmethod
from pathlib import Path

class AbstractDatabaseProcessor(ABC):

    def __init_subclass__(cls, **kwargs):
        """Function to validate that the custom dabataseclass is named 'DatabaseProcessor' correctly"""
        super().__init_subclass__(**kwargs)
        if cls.__name__ != "DatabaseProcessor":
            raise TypeError(f"The custom databaseclass classname must be 'DatabaseProcessor', not '{cls.__name__}'")

    @abstractmethod
    def __init__(self, database_path: Path) -> None:
        """Mandatory: This function should handle the creation of the tables if required
        The use of the database_path variable might not be required but you should still keep it as an argument!
        """
        pass

    @abstractmethod
    def open_database(self) -> None:
        """Mandatory: This function should handle the connection to the database and set it for other functions to use"""
        pass

    @abstractmethod
    def close_database(self) -> None:
        """Mandatory: This function is called to close the connection to the database"""
        pass

    @abstractmethod
    def run_start_exists(self, run_start: str) -> bool:
        """Mandatory: This function is called to check if the output is already present in the database, this is done to save time on needless reprocessing.
        If you want a very simple implementation without complex logic you can simply "return False". This will work but will reprocess needlessly.
        """
        pass

    @abstractmethod
    def insert_output_data(
        self, output_data: dict, tags: list, run_alias: str, path: Path, project_version: str, timezone: str = ""
    ) -> None:
        """Mandatory: This function inserts the data of an output file into the database"""
        pass

    @abstractmethod
    def get_data(self) -> dict:
        """Mandatory: This function gets all the data in the database"""
        pass

    @abstractmethod
    def list_runs(self) -> None:
        """Mandatory: This function gets all available runs and prints them to the console"""
        pass

    @abstractmethod
    def remove_runs(self, remove_runs: list) -> None:
        """Mandatory: This function removes all provided runs and all their corresponding data"""
        pass

    def update_output_path(self, log_path: str) -> None:
        """Optional: Function to update the output_path using the log path that the server has used"""
        raise NotImplementedError("update_output_path is not implemented in the custom databaseclass, but is only required when using the server!")