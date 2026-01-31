import os, logging

from axiom_py import Client
from axiom_py.logging import AxiomHandler

from dotenv import load_dotenv

load_dotenv()

def setup_logger(name: str = "app") -> logging.Logger:
    """
    Set up a logger with both Axiom (cloud) and console handlers.
    
    Args:
        name: The name of the logger (default: "app")
    
    Returns:
        A configured logger instance
    """

    logger = logging.getLogger(name)
    
    if logger.handlers:
        return logger
    
    # Change to either: INFO, DEBUG, WARNING, ERROR, CRITICAL
    logger.setLevel(logging.INFO)
    
    axiom_token = os.getenv("AXIOM_TOKEN")
    axiom_dataset = os.getenv("AXIOM_DATASET")
    
    if axiom_token:
        try:
            client = Client(axiom_token)
            axiom_handler = AxiomHandler(client, axiom_dataset) # type: ignore

            axiom_handler.setLevel(logging.INFO)
            logger.addHandler(axiom_handler)

            logger.info(f"Axiom logging enabled for dataset: {axiom_dataset}")
            
        except Exception as e:
            logger.warning(f"Failed to initialize Axiom logging: {e}")
    
    console_handler = logging.StreamHandler()

    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    ))

    logger.addHandler(console_handler)

    return logger

# Create a default logger instance
logger = setup_logger()