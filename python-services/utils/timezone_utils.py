"""
Timezone utility functions for IST (Indian Standard Time)
"""
import pytz
from datetime import datetime
from typing import Optional, Union

# IST timezone
IST = pytz.timezone('Asia/Kolkata')

class TimezoneUtils:
    """Utility class for timezone operations with IST"""
    
    @staticmethod
    def now() -> datetime:
        """Get current IST datetime"""
        return datetime.now(IST)
    
    @staticmethod
    def now_iso() -> str:
        """Get current IST timestamp in ISO format"""
        return TimezoneUtils.now().isoformat()
    
    @staticmethod
    def now_for_logging() -> str:
        """Get current IST timestamp formatted for logging"""
        return TimezoneUtils.now().strftime('%Y-%m-%d %H:%M:%S')
    
    @staticmethod
    def to_ist(dt: Union[datetime, str]) -> datetime:
        """Convert datetime to IST"""
        if isinstance(dt, str):
            # Parse ISO string
            dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
        
        if dt.tzinfo is None:
            # Assume UTC if no timezone info
            dt = pytz.UTC.localize(dt)
        
        return dt.astimezone(IST)
    
    @staticmethod
    def to_ist_iso(dt: Union[datetime, str]) -> str:
        """Convert datetime to IST ISO format"""
        ist_dt = TimezoneUtils.to_ist(dt)
        return ist_dt.isoformat()
    
    @staticmethod
    def to_ist_for_logging(dt: Union[datetime, str]) -> str:
        """Convert datetime to IST format for logging"""
        ist_dt = TimezoneUtils.to_ist(dt)
        return ist_dt.strftime('%Y-%m-%d %H:%M:%S')
    
    @staticmethod
    def utc_to_ist(utc_dt: datetime) -> datetime:
        """Convert UTC datetime to IST"""
        if utc_dt.tzinfo is None:
            utc_dt = pytz.UTC.localize(utc_dt)
        return utc_dt.astimezone(IST)
    
    @staticmethod
    def ist_to_utc(ist_dt: datetime) -> datetime:
        """Convert IST datetime to UTC"""
        if ist_dt.tzinfo is None:
            ist_dt = IST.localize(ist_dt)
        return ist_dt.astimezone(pytz.UTC)
    
    @staticmethod
    def format_for_api(dt: Union[datetime, str]) -> str:
        """Format datetime for API responses in IST"""
        if isinstance(dt, str):
            return TimezoneUtils.to_ist_iso(dt)
        return TimezoneUtils.to_ist(dt).isoformat()
    
    @staticmethod
    def parse_iso(iso_string: str) -> datetime:
        """Parse ISO string to IST datetime"""
        dt = datetime.fromisoformat(iso_string.replace('Z', '+00:00'))
        return TimezoneUtils.to_ist(dt)
    
    @staticmethod
    def get_timezone_info() -> dict:
        """Get IST timezone information"""
        now = TimezoneUtils.now()
        return {
            'timezone': 'Asia/Kolkata',
            'abbreviation': 'IST',
            'offset': now.strftime('%z'),
            'offset_hours': '+05:30',
            'is_dst': now.dst().total_seconds() != 0,
            'utc_offset_seconds': now.utcoffset().total_seconds()
        }
    
    @staticmethod
    def format_duration(seconds: float) -> str:
        """Format duration in human readable format"""
        if seconds >= 3600:
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            return f"{hours}h {minutes}m"
        elif seconds >= 60:
            minutes = int(seconds // 60)
            secs = int(seconds % 60)
            return f"{minutes}m {secs}s"
        else:
            return f"{seconds:.1f}s"
    
    @staticmethod
    def is_today_ist(dt: Union[datetime, str]) -> bool:
        """Check if datetime is today in IST"""
        if isinstance(dt, str):
            dt = TimezoneUtils.parse_iso(dt)
        
        ist_dt = TimezoneUtils.to_ist(dt)
        today = TimezoneUtils.now().date()
        return ist_dt.date() == today
    
    @staticmethod
    def start_of_day_ist(dt: Optional[Union[datetime, str]] = None) -> datetime:
        """Get start of day in IST"""
        if dt is None:
            dt = TimezoneUtils.now()
        elif isinstance(dt, str):
            dt = TimezoneUtils.parse_iso(dt)
        else:
            dt = TimezoneUtils.to_ist(dt)
        
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)
    
    @staticmethod
    def end_of_day_ist(dt: Optional[Union[datetime, str]] = None) -> datetime:
        """Get end of day in IST"""
        if dt is None:
            dt = TimezoneUtils.now()
        elif isinstance(dt, str):
            dt = TimezoneUtils.parse_iso(dt)
        else:
            dt = TimezoneUtils.to_ist(dt)
        
        return dt.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    @staticmethod
    def time_ago(dt: Union[datetime, str]) -> str:
        """Get human readable time ago string"""
        if isinstance(dt, str):
            dt = TimezoneUtils.parse_iso(dt)
        
        ist_dt = TimezoneUtils.to_ist(dt)
        now = TimezoneUtils.now()
        diff = now - ist_dt
        
        seconds = diff.total_seconds()
        
        if seconds < 60:
            return "just now"
        elif seconds < 3600:
            minutes = int(seconds // 60)
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        elif seconds < 86400:
            hours = int(seconds // 3600)
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        else:
            days = int(seconds // 86400)
            return f"{days} day{'s' if days != 1 else ''} ago"

# Convenience functions for common operations
def now_ist() -> datetime:
    """Get current IST datetime"""
    return TimezoneUtils.now()

def now_ist_iso() -> str:
    """Get current IST timestamp in ISO format"""
    return TimezoneUtils.now_iso()

def now_ist_log() -> str:
    """Get current IST timestamp for logging"""
    return TimezoneUtils.now_for_logging()

def to_ist_iso(dt: Union[datetime, str]) -> str:
    """Convert datetime to IST ISO format"""
    return TimezoneUtils.to_ist_iso(dt)

def format_for_api(dt: Union[datetime, str]) -> str:
    """Format datetime for API responses"""
    return TimezoneUtils.format_for_api(dt)
